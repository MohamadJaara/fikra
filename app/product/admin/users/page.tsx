"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Shield, ArrowLeft, Search, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";
import { toast, Toaster } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { useRolesMap } from "@/lib/hooks";

export default function AdminUsersPage() {
  const users = useQuery(api.admin.listUsers);
  const setUserAdmin = useMutation(api.admin.setUserAdmin);
  const roleLabels = useRolesMap();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!users) return [];
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.handle || "").toLowerCase().includes(q),
    );
  }, [users, search]);

  const handleToggleAdmin = async (
    userId: Id<"users">,
    currentAdmin: boolean,
    userName: string,
  ) => {
    try {
      await setUserAdmin({
        userId,
        isAdmin: !currentAdmin,
      });
      toast.success(
        `${userName} ${currentAdmin ? "demoted from admin" : "promoted to admin"}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    }
  };

  if (users === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/product/admin"
          className="text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserIcon className="h-6 w-6" />
            Users
          </h1>
          <p className="text-sm text-muted-foreground">
            {users.length} registered users
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or handle..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Handle</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Ideas</TableHead>
                <TableHead>Teams</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {search ? "No users match your search" : "No users found"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.image} />
                          <AvatarFallback className="text-xs">
                            {user.firstName?.[0] ||
                              user.name?.[0]?.toUpperCase() ||
                              "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {user.name || "Unnamed"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Joined{" "}
                            {new Date(user._creationTime).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{user.email}</TableCell>
                    <TableCell className="text-sm">
                      {user.handle ? `@${user.handle}` : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(user.roles || []).map((role) => (
                          <Badge
                            key={role}
                            variant="secondary"
                            className="text-xs"
                          >
                            {roleLabels[role] || role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {user.ownedIdeasCount}
                    </TableCell>
                    <TableCell className="text-sm">
                      {user.membershipsCount}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {user.isAdmin && (
                          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs w-fit">
                            Admin
                          </Badge>
                        )}
                        {user.onboardingComplete ? (
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs w-fit"
                          >
                            Onboarded
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs w-fit">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={user.isAdmin ? "destructive" : "outline"}
                        size="sm"
                        onClick={() =>
                          handleToggleAdmin(
                            user._id,
                            user.isAdmin ?? false,
                            user.name || user.email || "User",
                          )
                        }
                        className="text-xs"
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        {user.isAdmin ? "Remove Admin" : "Make Admin"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
      </div>

      <Toaster />
    </div>
  );
}
