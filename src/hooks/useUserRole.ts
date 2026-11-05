"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "Administrador" | "Encargada" | "Consulta";

const userRoles: UserRole[] = ["Administrador", "Encargada", "Consulta"];

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && userRoles.some((role) => role === value);
}

export function useUserRole(supabase: SupabaseClient) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRole() {
      const { data, error: roleError } = await supabase.rpc("rol_actual");
      if (!active) return;

      if (roleError) {
        setError(roleError.message);
      } else if (isUserRole(data)) {
        setRole(data);
      }
      setLoading(false);
    }

    void loadRole();
    return () => {
      active = false;
    };
  }, [supabase]);

  return {
    role,
    loading,
    error,
    isAdmin: role === "Administrador",
    canOperate: role === "Administrador" || role === "Encargada",
  };
}
