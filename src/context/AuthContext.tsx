import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
  } from "react";
  import type {
    AuthChangeEvent,
    Session,
    User,
  } from "@supabase/supabase-js";
  import { supabase } from "../lib/supabase";
  
  export type StaffRole =
    | "admin"
    | "reception"
    | "doctor"
    | "pharmacy"
    | "lab"
    | "nurse";
  
  export interface StaffProfile {
    id: string;
    name: string;
    email: string;
    role: StaffRole;
    department: string | null;
    specialization: string | null;
    status: string | null;
  }
  
  type AuthContextType = {
    user: User | null;
    profile: StaffProfile | null;
    role: StaffRole | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<StaffRole>;
    logout: () => Promise<void>;
  };
  
  const AuthContext = createContext<AuthContextType | null>(null);
  
  export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<StaffProfile | null>(null);
    const [role, setRole] = useState<StaffRole | null>(null);
    const [loading, setLoading] = useState(true);
  
    // Fetch the staff record for the logged-in auth user.
    // We match by EMAIL because it is guaranteed to exist on both the auth user
    // (session.user.email) and the staff row, so it works even before the
    // optional staff.auth_user_id column is populated by the link script.
    // Uses maybeSingle() so a missing row returns null instead of throwing
    // (single() throws PGRST116 when there are zero rows).
    const fetchStaff = async (authUser: {
      id: string;
      email?: string;
    }): Promise<StaffProfile | null> => {
      const email = authUser.email?.trim().toLowerCase();
      if (!email) return null;
  
      // First try the proper auth_user_id link, then fall back to email.
      // Each query only references columns that are guaranteed to exist.
      const byEmail = await supabase
        .schema("medicore")
        .from("staff")
        .select("id, name, email, role, department, specialization, status")
        .ilike("email", email)
        .maybeSingle();
  
      if (byEmail.error) {
        console.error("[MediCore] staff fetch error:", byEmail.error.message);
        return null;
      }
      return (byEmail.data as StaffProfile) ?? null;
    };
  
    const applySession = async (session: Session | null) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const staff = await fetchStaff(currentUser);
        setProfile(staff);
        setRole(staff?.role ?? null);
        // Logged in to auth but has no staff record -> kick them out so the
        // app never renders in a half-authenticated "role: null" state.
        if (!staff) {
          await supabase.auth.signOut();
        }
      } else {
        setProfile(null);
        setRole(null);
      }
    };
  
    const login = async (email: string, password: string): Promise<StaffRole> => {
      // Normalise the email so trailing spaces / caps don't cause a phantom failure.
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
  
      if (error) {
        // "Invalid login credentials" is Supabase's deliberately vague message for
        // both "no such email" and "wrong password". Keep the original for logging.
        console.error("[MediCore] LOGIN ERROR:", error.status, error.message);
        throw error;
      }
  
      const currentUser = data.user;
      if (!currentUser) throw new Error("Authentication failed (no user).");
  
      const staff = await fetchStaff(currentUser);
      if (!staff) {
        // Auth succeeded but this person isn't in the staff table. Sign them out
        // and surface a clear message instead of landing them on /dashboard null.
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setRole(null);
        throw new Error(
          "Your account is not linked to a staff record. Ask an administrator to set it up."
        );
      }
  
      setUser(currentUser);
      setProfile(staff);
      setRole(staff.role);
      return staff.role;
    };
  
    const logout = async () => {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setRole(null);
    };
  
    useEffect(() => {
      let mounted = true;
  
      (async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!mounted) return;
        await applySession(session);
        setLoading(false);
      })();
  
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, session: Session | null) => {
          if (mounted) void applySession(session);
        }
      );
  
      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }, []);
  
    return (
      <AuthContext.Provider
        value={{ user, profile, role, loading, login, logout }}
      >
        {children}
      </AuthContext.Provider>
    );
  }
  
  export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
      throw new Error("useAuth must be used inside AuthProvider");
    }
    return context;
  }
  