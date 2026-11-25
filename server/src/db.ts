import { PrismaClient } from "@prisma/client";

class InMemoryDatabase {
  private idCounters = {
    users: 1,
    wallets: 1,
    plans: 1,
    goals: 1,
    goalDeposits: 1,
    chores: 1,
    choreSubmissions: 1,
    transactions: 1,
    requests: 1,
    lessonProgress: 1,
    badges: 1,
    notifications: 1
  };

  private _users: any[] = [];
  private _wallets: any[] = [];
  private _plans: any[] = [];
  private _goals: any[] = [];
  private _goalDeposits: any[] = [];
  private _chores: any[] = [];
  private _choreSubmissions: any[] = [];
  private _transactions: any[] = [];
  private _requests: any[] = [];
  private _lessons: any[] = [];
  private _lessonProgress: any[] = [];
  private _badges: any[] = [];
  private _notifications: any[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    this._users = [];
    this._wallets = [];
    this._plans = [];
    this._goals = [];
    this._goalDeposits = [];
    this._chores = [];
    this._choreSubmissions = [];
    this._transactions = [];
    this._requests = [];
    this._lessons = [];
    this._lessonProgress = [];
    this._badges = [];
    this._notifications = [];
    this.idCounters = {
      users: 1,
      wallets: 1,
      plans: 1,
      goals: 1,
      goalDeposits: 1,
      chores: 1,
      choreSubmissions: 1,
      transactions: 1,
      requests: 1,
      lessonProgress: 1,
      badges: 1,
      notifications: 1
    };
  }

  async $transaction<T>(fn: (tx: this) => Promise<T>): Promise<T> {
    return fn(this);
  }

  private applyMath(existing: any, data: any) {
    const updated = { ...existing, ...data, updatedAt: new Date() };
    for (const key of Object.keys(data)) {
      if (data[key] && typeof data[key] === "object") {
        if ("increment" in data[key]) {
          updated[key] = (existing[key] || 0) + data[key].increment;
        } else if ("decrement" in data[key]) {
          updated[key] = (existing[key] || 0) - data[key].decrement;
        }
      }
    }
    return updated;
  }

  user = {
    findUnique: async (args: { where: { id?: number; email?: string }; include?: any }) => {
      let found = null;
      if (args.where.id !== undefined) {
        found = this._users.find(u => u.id === args.where.id) || null;
      } else if (args.where.email !== undefined) {
        found = this._users.find(u => u.email.toLowerCase() === args.where.email!.toLowerCase()) || null;
      }
      if (!found) return null;
      if (args.include) {
        return {
          ...found,
          wallet: args.include.wallet ? this._wallets.find(w => w.userId === found.id) || null : undefined,
          plan: args.include.plan ? this._plans.find(p => p.userId === found.id) || null : undefined
        };
      }
      return found;
    },
    findFirst: async (args: { where: any }) => {
      const all = await this.user.findMany(args);
      return all[0] || null;
    },
    findMany: async (args?: { where?: any; include?: any }) => {
      let results = [...this._users];
      if (args?.where) {
        if (args.where.parentId !== undefined) results = results.filter(u => u.parentId === args.where.parentId);
        if (args.where.accountMode !== undefined) results = results.filter(u => u.accountMode === args.where.accountMode);
        if (args.where.role !== undefined) results = results.filter(u => u.role === args.where.role);
      }
      if (args?.include) {
        results = results.map(u => ({
          ...u,
          wallet: args.include.wallet ? this._wallets.find(w => w.userId === u.id) || null : undefined,
          plan: args.include.plan ? this._plans.find(p => p.userId === u.id) || null : undefined
        }));
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
        streakDays: args.data.streakDays ?? 1,
        createdAt: now,
        updatedAt: now
      };
      this._users.push(newUser);
      if (args.data.wallet?.create) {
        await this.wallet.create({ data: { ...args.data.wallet.create, userId: id } });
      }
      if (args.data.plan?.create) {
        await this.plan.create({ data: { ...args.data.plan.create, userId: id } });
      }
      return newUser;
    },
    update: async (args: { where: { id: number }; data: any }) => {
      const idx = this._users.findIndex(u => u.id === args.where.id);
      if (idx === -1) throw new Error(`User ${args.where.id} not found`);
      const updated = this.applyMath(this._users[idx], args.data);
      this._users[idx] = updated;
      return updated;
    }
  };

  wallet = {
    findUnique: async (args: { where: { userId?: number; id?: number } }) => {
      if (args.where.userId !== undefined) return this._wallets.find(w => w.userId === args.where.userId) || null;
      if (args.where.id !== undefined) return this._wallets.find(w => w.id === args.where.id) || null;
      return null;
    },
    create: async (args: { data: any }) => {
      const id = this.idCounters.wallets++;
      const w = {
        id,
        userId: args.data.userId,
        everydayCents: args.data.everydayCents ?? 0,
        savingsCents: args.data.savingsCents ?? 0,
        emergencyCents: args.data.emergencyCents ?? 0,
        updatedAt: new Date()
      };
      this._wallets.push(w);
      return w;
    },
    update: async (args: { where: { userId?: number; id?: number }; data: any }) => {
      const idx = this._wallets.findIndex(w =>
        args.where.userId !== undefined ? w.userId === args.where.userId : w.id === args.where.id
      );
      if (idx === -1) throw new Error("Wallet not found");
      const updated = this.applyMath(this._wallets[idx], args.data);
      this._wallets[idx] = updated;
      return updated;
    }
  };

  plan = {
    findUnique: async (args: { where: { userId: number } }) => {
      return this._plans.find(p => p.userId === args.where.userId) || null;
    },
    create: async (args: { data: any }) => {
      const id = this.idCounters.plans++;
      const p = {
        id,
        userId: args.data.userId,
        splitEveryday: args.data.splitEveryday ?? 50,
        splitEmergency: args.data.splitEmergency ?? 20,
        splitSavings: args.data.splitSavings ?? 30,
        monthlyExpensesCents: args.data.monthlyExpensesCents ?? 2000000,
        updatedAt: new Date()
      };
      this._plans.push(p);
      return p;
    },
    update: async (args: { where: { userId: number }; data: any }) => {
      const idx = this._plans.findIndex(p => p.userId === args.where.userId);
      if (idx === -1) throw new Error("Plan not found");
      const updated = this.applyMath(this._plans[idx], args.data);
      this._plans[idx] = updated;
      return updated;
    }
  };

  goal = {
    findUnique: async (args: { where: { id: number } }) => {
      return this._goals.find(g => g.id === args.where.id) || null;
    },
    findMany: async (args?: { where?: any }) => {
      let results = [...this._goals];
      if (args?.where) {
        if (args.where.userId !== undefined) results = results.filter(g => g.userId === args.where.userId);
        if (args.where.status !== undefined) results = results.filter(g => g.status === args.where.status);
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
      const updated = this.applyMath(this._goals[idx], args.data);
      this._goals[idx] = updated;
      return updated;
    },
    delete: async (args: { where: { id: number } }) => {
      const idx = this._goals.findIndex(g => g.id === args.where.id);
      if (idx !== -1) return this._goals.splice(idx, 1)[0];
      return null;
    }
  };

  goalDeposit = {
    create: async (args: { data: any }) => {
      const id = this.idCounters.goalDeposits++;
      const dep = {
        id,
        goalId: args.data.goalId,
        userId: args.data.userId,
        amountCents: args.data.amountCents,
        note: args.data.note || "",
        createdAt: new Date()
      };
      this._goalDeposits.push(dep);
      return dep;
    },
    findMany: async (args?: { where?: any }) => {
      let res = [...this._goalDeposits];
      if (args?.where?.goalId !== undefined) res = res.filter(d => d.goalId === args.where.goalId);
      if (args?.where?.userId !== undefined) res = res.filter(d => d.userId === args.where.userId);
      return res;
    }
  };

  chore = {
    findUnique: async (args: { where: { id: number } }) => {
      return this._chores.find(c => c.id === args.where.id) || null;
    },
    findMany: async (args?: { where?: any; include?: any }) => {
      let res = [...this._chores];
      if (args?.where) {
        if (args.where.parentId !== undefined) res = res.filter(c => c.parentId === args.where.parentId);
        if (args.where.childId !== undefined) res = res.filter(c => c.childId === args.where.childId);
        if (args.where.status !== undefined) res = res.filter(c => c.status === args.where.status);
      }
      if (args?.include?.submissions) {
        res = res.map(c => ({
          ...c,
          submissions: this._choreSubmissions.filter(s => s.choreId === c.id)
        }));
      }
      return res;
    },
    create: async (args: { data: any }) => {
      const id = this.idCounters.chores++;
      const now = new Date();
      const ch = {
        id,
        parentId: args.data.parentId,
        childId: args.data.childId,
        title: args.data.title,
        description: args.data.description || "",
        rewardCents: args.data.rewardCents,
        status: args.data.status || "pending",
        dueDate: args.data.dueDate || null,
        createdAt: now,
        updatedAt: now
      };
      this._chores.push(ch);
      return ch;
    },
    update: async (args: { where: { id: number }; data: any }) => {
      const idx = this._chores.findIndex(c => c.id === args.where.id);
      if (idx === -1) throw new Error(`Chore ${args.where.id} not found`);
      const updated = this.applyMath(this._chores[idx], args.data);
      this._chores[idx] = updated;
      return updated;
    }
  };

  choreSubmission = {
    create: async (args: { data: any }) => {
      const id = this.idCounters.choreSubmissions++;
      const sub = {
        id,
        choreId: args.data.choreId,
        childId: args.data.childId,
        note: args.data.note || "",
        fileUrl: args.data.fileUrl || null,
        submittedAt: new Date()
      };
      this._choreSubmissions.push(sub);
      return sub;
    }
  };

  transaction = {
    findMany: async (args?: { where?: any; take?: number }) => {
      let results = [...this._transactions];
      if (args?.where?.userId !== undefined) {
        results = results.filter(t => t.userId === args.where.userId);
      }
      results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      if (args?.take) results = results.slice(0, args.take);
      return results;
    },
    create: async (args: { data: any }) => {
      const id = this.idCounters.transactions++;
      const newTx = {
        id,
        userId: args.data.userId,
        walletType: args.data.walletType || "everyday",
        type: args.data.type,
        amountCents: args.data.amountCents,
        note: args.data.note,
        createdAt: new Date()
      };
      this._transactions.push(newTx);
      return newTx;
    }
  };

  request = {
    findUnique: async (args: { where: { id: number } }) => {
      return this._requests.find(r => r.id === args.where.id) || null;
    },
    findMany: async (args?: { where?: any }) => {
      let results = [...this._requests];
      if (args?.where) {
        if (args.where.childId !== undefined) results = results.filter(r => r.childId === args.where.childId);
        if (args.where.parentId !== undefined) results = results.filter(r => r.parentId === args.where.parentId);
        if (args.where.status !== undefined) results = results.filter(r => r.status === args.where.status);
        if (args.where.OR) {
          results = results.filter(r =>
            args.where.OR.some((cond: any) => {
              let match = true;
              if (cond.parentId !== undefined && r.parentId !== cond.parentId) match = false;
              if (cond.partnerEmail !== undefined && r.partnerEmail?.toLowerCase() !== cond.partnerEmail?.toLowerCase()) match = false;
              if (cond.childId !== undefined && r.childId !== cond.childId) match = false;
              if (cond.status !== undefined && r.status !== cond.status) match = false;
              return match;
            })
          );
        }
      }
      return results;
    },
    create: async (args: { data: any }) => {
      const id = this.idCounters.requests++;
      const now = new Date();
      const req = {
        id,
        childId: args.data.childId,
        parentId: args.data.parentId ?? null,
        partnerEmail: args.data.partnerEmail ?? null,
        amountCents: args.data.amountCents,
        reason: args.data.reason,
        billFile: args.data.billFile ?? null,
        status: args.data.status || "pending",
        reviewedById: args.data.reviewedById ?? null,
        goalId: args.data.goalId ?? null,
        unlockAt: args.data.unlockAt ?? null,
        delayDays: args.data.delayDays ?? 0,
        type: args.data.type || "allowance",
        createdAt: now,
        updatedAt: now
      };
      this._requests.push(req);
      return req;
    },
    update: async (args: { where: { id: number }; data: any }) => {
      const idx = this._requests.findIndex(r => r.id === args.where.id);
      if (idx === -1) throw new Error(`Request ${args.where.id} not found`);
      const updated = this.applyMath(this._requests[idx], args.data);
      this._requests[idx] = updated;
      return updated;
    }
  };

  lessonProgress = {
    findMany: async (args?: { where?: any }) => {
      let res = [...this._lessonProgress];
      if (args?.where?.userId !== undefined) res = res.filter(l => l.userId === args.where.userId);
      return res;
    },
    upsert: async (args: { where: { userId_lessonId: { userId: number; lessonId: string } }; update: any; create: any }) => {
      const { userId, lessonId } = args.where.userId_lessonId;
      const idx = this._lessonProgress.findIndex(l => l.userId === userId && l.lessonId === lessonId);
      const now = new Date();
      if (idx !== -1) {
        this._lessonProgress[idx] = { ...this._lessonProgress[idx], ...args.update, completedAt: now };
        return this._lessonProgress[idx];
      } else {
        const id = this.idCounters.lessonProgress++;
        const item = { id, userId, lessonId, completed: args.create.completed ?? true, completedAt: now };
        this._lessonProgress.push(item);
        return item;
      }
    }
  };

  badge = {
    findMany: async (args?: { where?: any }) => {
      let res = [...this._badges];
      if (args?.where?.userId !== undefined) res = res.filter(b => b.userId === args.where.userId);
      return res;
    },
    upsert: async (args: { where: { userId_name: { userId: number; name: string } }; update: any; create: any }) => {
      const { userId, name } = args.where.userId_name;
      const existing = this._badges.find(b => b.userId === userId && b.name === name);
      if (existing) return existing;
      const id = this.idCounters.badges++;
      const badge = {
        id,
        userId,
        name,
        description: args.create.description || "",
        icon: args.create.icon || "🏆",
        unlockedAt: new Date()
      };
      this._badges.push(badge);
      return badge;
    }
  };

  notification = {
    findMany: async (args?: { where?: any }) => {
      let res = [...this._notifications];
      if (args?.where?.userId !== undefined) res = res.filter(n => n.userId === args.where.userId);
      return res.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    create: async (args: { data: any }) => {
      const id = this.idCounters.notifications++;
      const n = {
        id,
        userId: args.data.userId,
        title: args.data.title,
        message: args.data.message,
        read: false,
        createdAt: new Date()
      };
      this._notifications.push(n);
      return n;
    },
    update: async (args: { where: { id: number }; data: any }) => {
      const idx = this._notifications.findIndex(n => n.id === args.where.id);
      if (idx === -1) throw new Error("Notification not found");
      this._notifications[idx] = { ...this._notifications[idx], ...args.data };
      return this._notifications[idx];
    }
  };
}

export const inMemoryDb = new InMemoryDatabase();
export const realPrisma = new PrismaClient();

export const useRealDatabase = Boolean(
  process.env.DATABASE_URL &&
  !process.env.USE_MEMORY_DB &&
  process.env.NODE_ENV === "production"
);

export const db: any = useRealDatabase ? realPrisma : inMemoryDb;
export default db;
