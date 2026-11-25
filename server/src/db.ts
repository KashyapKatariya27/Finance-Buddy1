import { PrismaClient, Role, AccountMode, GoalCategory, GoalPriority, GoalStatus, ApprovalStatus, ApprovalType } from "@prisma/client";

// In-Memory Data Store fallback when PostgreSQL is not connected or in local dev/test
class InMemoryDatabase {
  private idCounters = {
    users: 1,
    goals: 1,
    transactions: 1,
    approvals: 1,
    learning: 1,
    events: 1
  };

  private _users: any[] = [];
  private _goals: any[] = [];
  private _transactions: any[] = [];
  private _approvals: any[] = [];
  private _learningProgress: any[] = [];
  private _appEvents: any[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    this._users = [];
    this._goals = [];
    this._transactions = [];
    this._approvals = [];
    this._learningProgress = [];
    this._appEvents = [];
    this.idCounters = {
      users: 1,
      goals: 1,
      transactions: 1,
      approvals: 1,
      learning: 1,
      events: 1
    };
  }

  user = {
    findUnique: async (args: { where: { id?: number; email?: string } }) => {
      if (args.where.id !== undefined) {
        return this._users.find(u => u.id === args.where.id) || null;
      }
      if (args.where.email !== undefined) {
        return this._users.find(u => u.email.toLowerCase() === args.where.email!.toLowerCase()) || null;
      }
      return null;
    },
    findFirst: async (args: { where: any }) => {
      const all = await this.user.findMany(args);
      return all[0] || null;
    },
    findMany: async (args?: { where?: any; orderBy?: any }) => {
      let results = [...this._users];
      if (args?.where) {
        if (args.where.parentId !== undefined) {
          results = results.filter(u => u.parentId === args.where.parentId);
        }
        if (args.where.accountMode !== undefined) {
          results = results.filter(u => u.accountMode === args.where.accountMode);
        }
        if (args.where.role !== undefined) {
          results = results.filter(u => u.role === args.where.role);
        }
      }
      return results;
    },
    create: async (args: { data: any }) => {
      const id = this.idCounters.users++;
      const now = new Date();
      const newUser = {
        id,
        fullName: args.data.fullName,
        email: args.data.email,
        passwordHash: args.data.passwordHash,
        role: args.data.role || "INDIVIDUAL",
        accountMode: args.data.accountMode || "FAMILY",
        age: args.data.age ?? 25,
        currency: args.data.currency || "INR",
        parentId: args.data.parentId ?? null,
        accountabilityPartnerEmail: args.data.accountabilityPartnerEmail ?? null,
        everydayCents: args.data.everydayCents ?? 0,
        emergencyCents: args.data.emergencyCents ?? 0,
        savingsCents: args.data.savingsCents ?? 0,
        splitEveryday: args.data.splitEveryday ?? 50,
        splitEmergency: args.data.splitEmergency ?? 20,
        splitSavings: args.data.splitSavings ?? 30,
        monthlyExpensesCents: args.data.monthlyExpensesCents ?? 2000000,
        streakDays: args.data.streakDays ?? 1,
        createdAt: now,
        updatedAt: now
      };
      this._users.push(newUser);
      return newUser;
    },
    update: async (args: { where: { id: number }; data: any }) => {
      const idx = this._users.findIndex(u => u.id === args.where.id);
      if (idx === -1) throw new Error(`User ${args.where.id} not found`);
      const user = this._users[idx];
      const updated = {
        ...user,
        ...args.data,
        updatedAt: new Date()
      };
      // Handle increment / decrement shorthand
      for (const key of Object.keys(args.data)) {
        if (args.data[key] && typeof args.data[key] === "object") {
          if ("increment" in args.data[key]) {
            updated[key] = (user[key] || 0) + args.data[key].increment;
          } else if ("decrement" in args.data[key]) {
            updated[key] = (user[key] || 0) - args.data[key].decrement;
          }
        }
      }
      this._users[idx] = updated;
      return updated;
    }
  };

  goal = {
    findUnique: async (args: { where: { id: number } }) => {
      return this._goals.find(g => g.id === args.where.id) || null;
    },
    findMany: async (args?: { where?: any; orderBy?: any }) => {
      let results = [...this._goals];
      if (args?.where) {
        if (args.where.userId !== undefined) {
          results = results.filter(g => g.userId === args.where.userId);
        }
        if (args.where.status !== undefined) {
          results = results.filter(g => g.status === args.where.status);
        }
      }
      return results;
    },
    create: async (args: { data: any }) => {
      const id = this.idCounters.goals++;
      const now = new Date();
      const newGoal = {
        id,
        userId: args.data.userId,
        name: args.data.name,
        category: args.data.category || "other",
        targetCents: args.data.targetCents,
        currentCents: args.data.currentCents || 0,
        deadline: args.data.deadline,
        priority: args.data.priority || "medium",
        icon: args.data.icon || "🎯",
        status: args.data.status || "active",
        autoSaveCents: args.data.autoSaveCents || 0,
        autoSaveFrequency: args.data.autoSaveFrequency || "none",
        roundUpEnabled: !!args.data.roundUpEnabled,
        createdAt: now,
        updatedAt: now
      };
      this._goals.push(newGoal);
      return newGoal;
    },
    update: async (args: { where: { id: number }; data: any }) => {
      const idx = this._goals.findIndex(g => g.id === args.where.id);
      if (idx === -1) throw new Error(`Goal ${args.where.id} not found`);
      const goal = this._goals[idx];
      const updated = {
        ...goal,
        ...args.data,
        updatedAt: new Date()
      };
      for (const key of Object.keys(args.data)) {
        if (args.data[key] && typeof args.data[key] === "object") {
          if ("increment" in args.data[key]) {
            updated[key] = (goal[key] || 0) + args.data[key].increment;
          } else if ("decrement" in args.data[key]) {
            updated[key] = (goal[key] || 0) - args.data[key].decrement;
          }
        }
      }
      this._goals[idx] = updated;
      return updated;
    },
    delete: async (args: { where: { id: number } }) => {
      const idx = this._goals.findIndex(g => g.id === args.where.id);
      if (idx !== -1) {
        const deleted = this._goals.splice(idx, 1)[0];
        return deleted;
      }
      return null;
    }
  };

  transaction = {
    findMany: async (args?: { where?: any; orderBy?: any; take?: number }) => {
      let results = [...this._transactions];
      if (args?.where) {
        if (args.where.userId !== undefined) {
          results = results.filter(t => t.userId === args.where.userId);
        }
      }
      results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      if (args?.take) {
        results = results.slice(0, args.take);
      }
      return results;
    },
    create: async (args: { data: any }) => {
      const id = this.idCounters.transactions++;
      const newTx = {
        id,
        userId: args.data.userId,
        type: args.data.type,
        amountCents: args.data.amountCents,
        note: args.data.note,
        createdAt: new Date()
      };
      this._transactions.push(newTx);
      return newTx;
    }
  };

  approval = {
    findUnique: async (args: { where: { id: number } }) => {
      return this._approvals.find(a => a.id === args.where.id) || null;
    },
    findMany: async (args?: { where?: any; orderBy?: any }) => {
      let results = [...this._approvals];
      if (args?.where) {
        if (args.where.childId !== undefined) {
          results = results.filter(a => a.childId === args.where.childId);
        }
        if (args.where.parentId !== undefined) {
          results = results.filter(a => a.parentId === args.where.parentId);
        }
        if (args.where.partnerEmail !== undefined) {
          results = results.filter(a => a.partnerEmail?.toLowerCase() === args.where.partnerEmail.toLowerCase());
        }
        if (args.where.status !== undefined) {
          results = results.filter(a => a.status === args.where.status);
        }
        if (args.where.OR) {
          results = results.filter(a => {
            return args.where.OR.some((cond: any) => {
              let match = true;
              if (cond.parentId !== undefined && a.parentId !== cond.parentId) match = false;
              if (cond.partnerEmail !== undefined && a.partnerEmail?.toLowerCase() !== cond.partnerEmail?.toLowerCase()) match = false;
              if (cond.childId !== undefined && a.childId !== cond.childId) match = false;
              if (cond.status !== undefined && a.status !== cond.status) match = false;
              return match;
            });
          });
        }
      }
      return results;
    },
    create: async (args: { data: any }) => {
      const id = this.idCounters.approvals++;
      const now = new Date();
      const newApproval = {
        id,
        childId: args.data.childId,
        parentId: args.data.parentId ?? null,
        partnerEmail: args.data.partnerEmail ?? null,
        amountCents: args.data.amountCents,
        reason: args.data.reason,
        status: args.data.status || "pending",
        reviewedById: args.data.reviewedById ?? null,
        goalId: args.data.goalId ?? null,
        unlockAt: args.data.unlockAt ?? null,
        coolingOff: !!args.data.coolingOff,
        delayDays: args.data.delayDays ?? 0,
        type: args.data.type || "allowance",
        createdAt: now,
        updatedAt: now
      };
      this._approvals.push(newApproval);
      return newApproval;
    },
    update: async (args: { where: { id: number }; data: any }) => {
      const idx = this._approvals.findIndex(a => a.id === args.where.id);
      if (idx === -1) throw new Error(`Approval ${args.where.id} not found`);
      const approval = this._approvals[idx];
      const updated = {
        ...approval,
        ...args.data,
        updatedAt: new Date()
      };
      this._approvals[idx] = updated;
      return updated;
    }
  };

  learningProgress = {
    findMany: async (args?: { where?: any }) => {
      let results = [...this._learningProgress];
      if (args?.where) {
        if (args.where.userId !== undefined) {
          results = results.filter(l => l.userId === args.where.userId);
        }
        if (args.where.moduleId !== undefined) {
          results = results.filter(l => l.moduleId === args.where.moduleId);
        }
      }
      return results;
    },
    upsert: async (args: { where: { userId_moduleId: { userId: number; moduleId: string } }; update: any; create: any }) => {
      const { userId, moduleId } = args.where.userId_moduleId;
      const idx = this._learningProgress.findIndex(l => l.userId === userId && l.moduleId === moduleId);
      const now = new Date();
      if (idx !== -1) {
        this._learningProgress[idx] = {
          ...this._learningProgress[idx],
          ...args.update,
          completedAt: now
        };
        return this._learningProgress[idx];
      } else {
        const id = this.idCounters.learning++;
        const item = {
          id,
          userId,
          moduleId,
          completed: args.create.completed ?? true,
          completedAt: now
        };
        this._learningProgress.push(item);
        return item;
      }
    }
  };

  appEvent = {
    create: async (args: { data: any }) => {
      const id = this.idCounters.events++;
      const newEvent = {
        id,
        userId: args.data.userId,
        action: args.data.action,
        details: args.data.details || "",
        createdAt: new Date()
      };
      this._appEvents.push(newEvent);
      return newEvent;
    },
    findMany: async (args?: { where?: any; take?: number }) => {
      let results = [...this._appEvents];
      if (args?.where?.userId !== undefined) {
        results = results.filter(e => e.userId === args.where.userId);
      }
      results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      if (args?.take) {
        results = results.slice(0, args.take);
      }
      return results;
    }
  };
}

// Singleton instances
export const inMemoryDb = new InMemoryDatabase();
export const realPrisma = new PrismaClient();

// Detect whether PostgreSQL is enabled and reachable
export const useRealDatabase = Boolean(
  process.env.DATABASE_URL &&
  !process.env.USE_MEMORY_DB &&
  process.env.NODE_ENV === "production"
);

export const db: any = useRealDatabase ? realPrisma : inMemoryDb;
export default db;
