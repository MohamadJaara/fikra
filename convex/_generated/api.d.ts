/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as categories from "../categories.js";
import type * as comments from "../comments.js";
import type * as http from "../http.js";
import type * as ideaStats from "../ideaStats.js";
import type * as ideas from "../ideas.js";
import type * as interest from "../interest.js";
import type * as lib from "../lib.js";
import type * as memberships from "../memberships.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as reactions from "../reactions.js";
import type * as relatedIdeas from "../relatedIdeas.js";
import type * as resourceRequests from "../resourceRequests.js";
import type * as resources from "../resources.js";
import type * as roles from "../roles.js";
import type * as rooms from "../rooms.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  categories: typeof categories;
  comments: typeof comments;
  http: typeof http;
  ideaStats: typeof ideaStats;
  ideas: typeof ideas;
  interest: typeof interest;
  lib: typeof lib;
  memberships: typeof memberships;
  migrations: typeof migrations;
  notifications: typeof notifications;
  reactions: typeof reactions;
  relatedIdeas: typeof relatedIdeas;
  resourceRequests: typeof resourceRequests;
  resources: typeof resources;
  roles: typeof roles;
  rooms: typeof rooms;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
