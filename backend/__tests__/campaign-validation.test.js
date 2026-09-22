const request = require('supertest');
const express = require('express');
const { get, all, run } = require('../db');

jest.mock('../db', () => ({
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { client_id: 1, is_admin: 0 };
    next();
  },
  requireRole: () => (req, res, next) => next(),
}));

jest.mock('../services/entitlements', () => ({
  enforceLimit: jest.fn().mockResolvedValue(true)
}), { virtual: true });

// Mock express-rate-limit to pass through
jest.mock('express-rate-limit', () => () => (req, res, next) => next());

const campaignsRouter = require('../routes/campaigns');
const app = express();
app.use(express.json());
app.use('/api/campaigns', campaignsRouter);

describe('Campaign Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseCampaign = {
    id: 1,
    client_id: 1,
    status: 'draft',
    agent_id: 'agent-123',
    phone_number_id: 'phone-123',
    contact_list: JSON.stringify([1, 2, 3])
  };

  it('should prevent starting campaign without an agent assigned', async () => {
    get.mockResolvedValueOnce({ ...baseCampaign, agent_id: null });
    const res = await request(app).post('/api/campaigns/1/start');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must have an agent assigned/i);
  });

  it('should prevent starting campaign without a phone number assigned', async () => {
    get.mockResolvedValueOnce({ ...baseCampaign, phone_number_id: null });
    const res = await request(app).post('/api/campaigns/1/start');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must have a phone number assigned/i);
  });

  it('should prevent starting campaign with zero contacts', async () => {
    get.mockResolvedValueOnce({ ...baseCampaign, contact_list: JSON.stringify([]) });
    const res = await request(app).post('/api/campaigns/1/start');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must have contacts assigned/i);
  });

  it('should prevent starting if agent is not found (archived/inactive)', async () => {
    get
      .mockResolvedValueOnce(baseCampaign) // get campaign
      .mockResolvedValueOnce(null) // client_agents
      .mockResolvedValueOnce(null); // gemini_agents

    const res = await request(app).post('/api/campaigns/1/start');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/agent not found/i);
  });

  it('should exclude DNC contacts and start if valid contacts remain', async () => {
    get
      .mockResolvedValueOnce(baseCampaign) // campaign
      .mockResolvedValueOnce({ name: 'Test Agent' }) // agent
      .mockResolvedValueOnce({ phone_number: '+1234567890' }); // phone

    // contacts info
    all.mockResolvedValueOnce([
      { id: 1, phone_e164: '+1111111111' },
      { id: 2, phone_e164: '+2222222222' },
      { id: 3, phone_e164: '+3333333333' }
    ]);
    
    // DNC list
    all.mockResolvedValueOnce([
      { phone_e164: '+2222222222' } // Contact 2 is DNC
    ]);

    run.mockResolvedValueOnce({ changes: 1 }); // update campaign status

    const res = await request(app).post('/api/campaigns/1/start');
    
    expect(res.status).toBe(200);
    expect(res.body.data.summary.total_contacts).toBe(3);
    expect(res.body.data.summary.valid_contacts).toBe(2);
    expect(res.body.data.summary.dnc_excluded).toBe(1);
    
    // Check that run was called with valid_contacts = 2
    expect(run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE campaigns SET'),
      expect.arrayContaining(['running', 3, 2, 1, '1'])
    );
  });

  it('should prevent starting if all contacts are DNC', async () => {
    get
      .mockResolvedValueOnce(baseCampaign) 
      .mockResolvedValueOnce({ name: 'Test Agent' }) 
      .mockResolvedValueOnce({ phone_number: '+1234567890' });

    all.mockResolvedValueOnce([
      { id: 1, phone_e164: '+1111111111' }
    ]);
    all.mockResolvedValueOnce([
      { phone_e164: '+1111111111' }
    ]);

    const res = await request(app).post('/api/campaigns/1/start');
    
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No valid contacts after applying DNC list/i);
    expect(run).not.toHaveBeenCalled();
  });
});
