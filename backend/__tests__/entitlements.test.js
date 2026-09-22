const { get } = require('../db');
const {
  getClientPlanLimits,
  checkAgentLimit,
  checkPhoneNumberLimit,
  checkCallLimit
} = require('../lib/plan-limits');

jest.mock('../db', () => ({
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn()
}));

describe('Entitlements and Plan Limits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getClientPlanLimits', () => {
    it('should return client plan limits if client has a plan', async () => {
      get.mockResolvedValueOnce({
        max_agents: 5,
        max_calls_per_month: 1000,
        max_phone_numbers: 2,
        features: '{}',
        plan_name: 'Pro'
      });

      const limits = await getClientPlanLimits(1);
      expect(limits.plan_name).toBe('Pro');
      expect(limits.max_agents).toBe(5);
    });

    it('should return default plan if client has no plan assigned', async () => {
      get
        .mockResolvedValueOnce(null) // No client plan
        .mockResolvedValueOnce({
          max_agents: 1,
          max_calls_per_month: 100,
          max_phone_numbers: 1,
          features: '{}',
          plan_name: 'Free Default'
        }); // Default plan fallback

      const limits = await getClientPlanLimits(1);
      expect(limits.plan_name).toBe('Free Default');
    });

    it('should return hardcoded fallback if no default plan found', async () => {
      get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const limits = await getClientPlanLimits(1);
      expect(limits.plan_name).toBe('Free');
      expect(limits.max_agents).toBe(1);
    });
  });

  describe('checkAgentLimit', () => {
    it('should allow if max_agents is -1 (unlimited)', async () => {
      get.mockResolvedValueOnce({ max_agents: -1 });
      const result = await checkAgentLimit(1);
      expect(result.allowed).toBe(true);
    });

    it('should allow if current agents < max_agents', async () => {
      get
        .mockResolvedValueOnce({ max_agents: 5 }) // limits
        .mockResolvedValueOnce({ count: 2 }); // current agent count

      const result = await checkAgentLimit(1);
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(2);
    });

    it('should deny if current agents >= max_agents', async () => {
      get
        .mockResolvedValueOnce({ max_agents: 5, plan_name: 'Basic' }) 
        .mockResolvedValueOnce({ count: 5 }); 

      const result = await checkAgentLimit(1);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Agent limit reached/);
    });
  });

  describe('checkPhoneNumberLimit', () => {
    it('should allow if max_phone_numbers is -1 (unlimited)', async () => {
      get.mockResolvedValueOnce({ max_phone_numbers: -1 });
      const result = await checkPhoneNumberLimit(1);
      expect(result.allowed).toBe(true);
    });

    it('should deny if current numbers >= max_phone_numbers', async () => {
      get
        .mockResolvedValueOnce({ max_phone_numbers: 1, plan_name: 'Free' }) 
        .mockResolvedValueOnce({ count: 1 }); 

      const result = await checkPhoneNumberLimit(1);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Phone number limit reached/);
    });
  });

  describe('checkCallLimit', () => {
    it('should allow if max_calls_per_month is -1 (unlimited)', async () => {
      get.mockResolvedValueOnce({ max_calls_per_month: -1 });
      const result = await checkCallLimit(1);
      expect(result.allowed).toBe(true);
    });

    it('should deny if current calls >= max_calls_per_month', async () => {
      get
        .mockResolvedValueOnce({ max_calls_per_month: 100, plan_name: 'Free' }) 
        .mockResolvedValueOnce({ count: 105 }); 

      const result = await checkCallLimit(1);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Monthly call limit reached/);
    });
  });
});
