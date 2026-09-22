const request = require('supertest');
const express = require('express');
const { get, all, run } = require('../db');

jest.mock('../db', () => ({
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn()
}));

// Mock auth middleware so we can easily inject user
jest.mock('../middleware/auth', () => ({
  authenticate: (req, res, next) => {
    const token = req.headers.authorization;
    if (token === 'Bearer token1') {
      req.user = { client_id: 1, clientId: 1, id: 1, is_admin: 0 };
      req.client = { id: 1, is_admin: 0 };
    } else if (token === 'Bearer token2') {
      req.user = { client_id: 2, clientId: 2, id: 2, is_admin: 0 };
      req.client = { id: 2, is_admin: 0 };
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  },
  requireRole: () => (req, res, next) => next(),
}));

const contactsRouter = require('../routes/contacts');
const campaignsRouter = require('../routes/campaigns');
const callsRouter = require('../routes/calls');
const agentsRouter = require('../routes/agents');

const app = express();
app.use(express.json());
app.use('/api/contacts', contactsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/calls', callsRouter);
app.use('/api/agents', agentsRouter);

describe('Tenant Isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/contacts', () => {
    it('should only query contacts for client 1', async () => {
      await request(app).get('/api/contacts').set('Authorization', 'Bearer token1');
      expect(all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE client_id = ?'),
        expect.arrayContaining([1])
      );
    });

    it('should only query contacts for client 2', async () => {
      await request(app).get('/api/contacts').set('Authorization', 'Bearer token2');
      expect(all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE client_id = ?'),
        expect.arrayContaining([2])
      );
    });
  });

  describe('GET /api/campaigns', () => {
    it('should only query campaigns for client 1', async () => {
      await request(app).get('/api/campaigns').set('Authorization', 'Bearer token1');
      expect(all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE client_id = ?'),
        expect.arrayContaining([1])
      );
    });
  });

  describe('GET /api/calls/list', () => {
    it('should only query calls for client 1', async () => {
      await request(app).get('/api/calls/list').set('Authorization', 'Bearer token1');
      expect(all).toHaveBeenCalledWith(
        expect.stringContaining('client_id = ?'),
        expect.arrayContaining([1])
      );
    });
  });

  describe('GET /api/agents', () => {
    it('should only query agents for client 1', async () => {
      await request(app).get('/api/agents').set('Authorization', 'Bearer token1');
      expect(all).toHaveBeenCalledWith(
        expect.stringContaining('client_id = ?'),
        expect.arrayContaining([1])
      );
    });
  });

  describe('DELETE /api/contacts/:id', () => {
    it('should include client_id in delete query to prevent IDOR', async () => {
      run.mockResolvedValueOnce({ changes: 0 }); // simulate not found for client 1
      const res = await request(app).delete('/api/contacts/999').set('Authorization', 'Bearer token1');
      expect(run).toHaveBeenCalledWith(
        expect.stringContaining('client_id = ?'),
        expect.arrayContaining(['999', 1])
      );
      expect(res.status).toBe(404); // Returns 404, not 403, preventing enumeration
    });
  });

  describe('PUT /api/campaigns/:id (PATCH equivalent)', () => {
    it('should include client_id in update query to prevent IDOR', async () => {
      get.mockResolvedValueOnce(null); // simulate not found when checking ownership
      const res = await request(app)
        .put('/api/campaigns/888')
        .set('Authorization', 'Bearer token1')
        .send({ name: 'Hacked' });
      
      expect(get).toHaveBeenCalledWith(
        expect.stringContaining('client_id = ?'),
        expect.arrayContaining(['888', 1])
      );
      expect(res.status).toBe(404);
    });
  });
});
