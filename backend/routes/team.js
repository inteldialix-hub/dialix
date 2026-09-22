const express = require('express');
const crypto = require('crypto');
const { all, get, run } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const VALID_ROLES = ['owner', 'admin', 'manager', 'viewer'];

/**
 * GET /api/team/invitation/:token
 * Public endpoint to verify an invitation token before signup/login.
 */
router.get('/invitation/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const inv = await get(
      "SELECT id, client_id, email, role, status, expires_at FROM team_invitations WHERE token = ? AND status = 'pending'",
      [token]
    );
    if (!inv) {
      return res.status(404).json({ valid: false, error: 'Invitation not found or has expired' });
    }
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      return res.status(410).json({ valid: false, error: 'Invitation has expired' });
    }

    // Get organization / inviter name
    const org = await get('SELECT name FROM clients WHERE id = ?', [inv.client_id]);

    res.json({
      valid: true,
      email: inv.email,
      role: inv.role,
      organization_name: org?.name || 'Dialix Organization',
    });
  } catch (err) {
    console.error('GET /api/team/invitation/:token error:', err);
    res.status(500).json({ valid: false, error: 'Failed to verify invitation' });
  }
});

router.use(authenticate);

/**
 * GET /api/team
 * Get team members and pending invitations for the current client organization.
 */
router.get('/', async (req, res) => {
  try {
    const clientId = req.client.id;

    // Check if team_members has any records for this client
    let members = await all(
      'SELECT id, email, name, role, created_at FROM team_members WHERE client_id = ? ORDER BY created_at ASC',
      [clientId]
    );

    // If empty, auto-seed the current client as 'owner'
    if (!members || members.length === 0) {
      const client = await get('SELECT id, name, email FROM clients WHERE id = ?', [clientId]);
      if (client) {
        await run(
          `INSERT INTO team_members (client_id, email, name, role, created_at)
           VALUES (?, ?, ?, 'owner', datetime('now'))`,
          [clientId, client.email, client.name || 'Account Owner']
        );
        members = await all(
          'SELECT id, email, name, role, created_at FROM team_members WHERE client_id = ? ORDER BY created_at ASC',
          [clientId]
        );
      }
    }

    // Fetch pending invitations
    const invitations = await all(
      'SELECT id, email, role, token, status, expires_at, created_at FROM team_invitations WHERE client_id = ? AND status = ? ORDER BY created_at DESC',
      [clientId, 'pending']
    );

    const baseUrl = process.env.FRONTEND_URL || 'https://inteldialix.online';

    const formattedInvitations = (invitations || []).map(inv => ({
      ...inv,
      invite_url: `${baseUrl}/signup?invite=${inv.token}`,
    }));

    res.json({
      success: true,
      members: members || [],
      team: members || [],
      invitations: formattedInvitations,
    });
  } catch (err) {
    console.error('GET /api/team error:', err);
    res.status(500).json({ error: 'Failed to fetch team data' });
  }
});

/**
 * POST /api/team/invite
 * Create a team invitation and generate instant copyable invite URL.
 */
router.post('/invite', async (req, res) => {
  try {
    const clientId = req.client.id;
    const { email, role = 'viewer' } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const cleanRole = String(role).toLowerCase();
    if (!VALID_ROLES.includes(cleanRole) || cleanRole === 'owner') {
      return res.status(400).json({ error: 'Role must be admin, manager, or viewer' });
    }

    // Check if already an active member
    const existingMember = await get(
      'SELECT id FROM team_members WHERE client_id = ? AND email = ?',
      [clientId, cleanEmail]
    );
    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this team' });
    }

    // Check if pending invite already exists
    const existingInvite = await get(
      'SELECT id FROM team_invitations WHERE client_id = ? AND email = ? AND status = ?',
      [clientId, cleanEmail, 'pending']
    );

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
    const baseUrl = process.env.FRONTEND_URL || 'https://inteldialix.online';
    const inviteUrl = `${baseUrl}/signup?invite=${token}`;

    let inviteId;
    if (existingInvite) {
      await run(
        `UPDATE team_invitations SET role = ?, token = ?, expires_at = ?, created_at = datetime('now')
         WHERE id = ?`,
        [cleanRole, token, expiresAt, existingInvite.id]
      );
      inviteId = existingInvite.id;
    } else {
      const result = await run(
        `INSERT INTO team_invitations (
          client_id, email, role, token, status, expires_at, created_at
        ) VALUES (?, ?, ?, ?, 'pending', ?, datetime('now'))`,
        [clientId, cleanEmail, cleanRole, token, expiresAt]
      );
      inviteId = result.lastInsertRowid;
    }

    try {
      const client = await get('SELECT name FROM clients WHERE id = ?', [clientId]);
      const orgName = client?.name || 'Dialix Organization';
      const { sendTeamInviteEmail } = require('../services/email');
      await sendTeamInviteEmail(cleanEmail, orgName, orgName, inviteUrl);
    } catch (e) {
      console.error('Failed to send invite email:', e);
    }

    res.status(201).json({
      success: true,
      invite_url: inviteUrl,
      message: 'Invitation created successfully',
      invitation: {
        id: inviteId,
        email: cleanEmail,
        role: cleanRole,
        token,
        invite_url: inviteUrl,
        expires_at: expiresAt,
      },
    });
  } catch (err) {
    console.error('POST /api/team/invite error:', err);
    res.status(500).json({ error: 'Failed to create team invitation' });
  }
});

/**
 * DELETE /api/team/invitations/:id
 * Revoke a pending team invitation.
 */
router.delete('/invitations/:id', async (req, res) => {
  try {
    const clientId = req.client.id;
    const inviteId = req.params.id;

    const existing = await get(
      'SELECT id FROM team_invitations WHERE id = ? AND client_id = ?',
      [inviteId, clientId]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    await run('DELETE FROM team_invitations WHERE id = ? AND client_id = ?', [inviteId, clientId]);
    res.json({ success: true, message: 'Invitation revoked' });
  } catch (err) {
    console.error('DELETE /api/team/invitations/:id error:', err);
    res.status(500).json({ error: 'Failed to revoke invitation' });
  }
});

/**
 * DELETE /api/team/members/:id
 * Remove a team member (prevent removing owner).
 */
router.delete('/members/:id', async (req, res) => {
  try {
    const clientId = req.client.id;
    const memberId = req.params.id;

    const member = await get(
      'SELECT id, email, role FROM team_members WHERE id = ? AND client_id = ?',
      [memberId, clientId]
    );
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    if (member.role === 'owner') {
      return res.status(400).json({ error: 'Cannot remove organization owner' });
    }

    // Also prevent removing the client's own primary email
    if (member.email === req.client.email) {
      return res.status(400).json({ error: 'Cannot remove primary account holder' });
    }

    await run('DELETE FROM team_members WHERE id = ? AND client_id = ?', [memberId, clientId]);
    res.json({ success: true, message: 'Team member removed' });
  } catch (err) {
    console.error('DELETE /api/team/members/:id error:', err);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

/**
 * PATCH /api/team/members/:id/role
 * Change role of a team member.
 */
router.patch('/members/:id/role', async (req, res) => {
  try {
    const clientId = req.client.id;
    const memberId = req.params.id;
    const { role } = req.body;

    const cleanRole = String(role).toLowerCase();
    if (!VALID_ROLES.includes(cleanRole) || cleanRole === 'owner') {
      return res.status(400).json({ error: 'Role must be admin, manager, or viewer' });
    }

    const member = await get(
      'SELECT id, role FROM team_members WHERE id = ? AND client_id = ?',
      [memberId, clientId]
    );
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    if (member.role === 'owner') {
      return res.status(400).json({ error: 'Cannot change role of organization owner' });
    }

    await run(
      'UPDATE team_members SET role = ? WHERE id = ? AND client_id = ?',
      [cleanRole, memberId, clientId]
    );

    res.json({ success: true, member_id: memberId, role: cleanRole });
  } catch (err) {
    console.error('PATCH /api/team/members/:id/role error:', err);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

module.exports = router;
