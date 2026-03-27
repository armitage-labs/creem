import { QueryCtx, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { creem } from "./billing";

export const MAX_FREE_TODOS = 3;
export const MAX_PREMIUM_TODOS = 6;

// In a real app you'll set up authentication, we just use a
// fake user for the example.
const currentUser = async (ctx: QueryCtx) => {
  const user = await ctx.db.query("users").first();
  if (!user) {
    return null;
  }
  const subscription = await creem.subscriptions.getCurrent(ctx, {
    entityId: user._id,
  });
  const productName = subscription?.product?.name?.toLowerCase() ?? "";
  const isPremium = productName.includes("premium");
  const isBasic = productName.includes("basic") && !isPremium;
  return {
    ...user,
    isFree: !isPremium && !isBasic,
    isPremium,
    isBasic,
    isTrialing: subscription?.status === "trialing",
    trialEnd: subscription?.trialEnd ?? null,
    subscription,
    maxTodos: isPremium
      ? undefined
      : isBasic
        ? MAX_PREMIUM_TODOS
        : MAX_FREE_TODOS,
  };
};

// Query that returns our pseudo user.
export const getCurrentUser = query({
  handler: async (ctx) => {
    return currentUser(ctx);
  },
});

export const createDemoUser = mutation({
  args: {},
  handler: async (ctx) => {
    const existingUser = await ctx.db.query("users").first();
    if (existingUser) {
      return existingUser;
    }

    const email = process.env.TEST_USER_EMAIL;
    if (!email) {
      throw new Error("TEST_USER_EMAIL environment variable is not set");
    }

    const userId = await ctx.db.insert("users", {
      email,
    });
    return {
      _id: userId,
      email,
    };
  },
});

export const authorizeTodo = async (ctx: QueryCtx, todoId: Id<"todos">) => {
  const user = await currentUser(ctx);
  if (!user) {
    throw new Error("No user found");
  }
  const todo = await ctx.db.get(todoId);
  if (!todo || todo.userId !== user._id) {
    throw new Error("Todo not found");
  }
};

export const listTodos = query({
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) {
      return [];
    }
    return ctx.db
      .query("todos")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const insertTodo = mutation({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) {
      throw new Error("No user found. Create a demo user first.");
    }
    const todoCount = (
      await ctx.db
        .query("todos")
        .withIndex("userId", (q) => q.eq("userId", user._id))
        .collect()
    ).length;
    if (!user.subscription && todoCount >= MAX_FREE_TODOS) {
      throw new Error("Reached maximum number of todos for free plan");
    }
    if (user.isBasic && todoCount >= MAX_PREMIUM_TODOS) {
      throw new Error("Reached maximum number of todos for basic plan");
    }
    await ctx.db.insert("todos", {
      userId: user._id,
      text: args.text,
      completed: false,
    });
  },
});

export const updateTodoText = mutation({
  args: {
    todoId: v.id("todos"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await authorizeTodo(ctx, args.todoId);
    await ctx.db.patch(args.todoId, { text: args.text });
  },
});

export const completeTodo = mutation({
  args: {
    todoId: v.id("todos"),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    await authorizeTodo(ctx, args.todoId);
    await ctx.db.patch(args.todoId, { completed: args.completed });
  },
});

export const deleteTodo = mutation({
  args: {
    todoId: v.id("todos"),
  },
  handler: async (ctx, args) => {
    await authorizeTodo(ctx, args.todoId);
    await ctx.db.delete(args.todoId);
  },
});
