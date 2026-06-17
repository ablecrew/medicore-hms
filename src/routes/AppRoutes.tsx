import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoutes";

import AppLayout from "../layouts/AppLayout";

import Dashboard from "../pages/Dashboard";
import Patients from "../pages/Patients";
import Billing from "../pages/Billing";
import Lab from "../pages/Lab";
import Pharmacy from "../pages/Pharmacy";
import Appointments from "../pages/Appointments";
import Login from "../pages/auth/Login";
import StaffManagement from "../pages/staff/StaffManagement";
import Landing from "../pages/Landing";
import Consultations from "@/pages/Consultations";
import Addmissions from "../pages/Addmissions";
import Notifications from "@/pages/Notifications";
import Reports from "@/pages/Reports";

const appRoles = ["admin", "doctor", "lab", "pharmacy", "reception", "nurse"];

function Unauthorized() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="rounded-2xl bg-white p-6 text-center shadow">
        <h1 className="text-xl font-bold text-slate-900">Unauthorized</h1>
        <p className="mt-2 text-slate-500">
          You do not have permission to access this page.
        </p>
      </div>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* PUBLIC */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* PROTECTED APP SHELL */}
      <Route
        element={
          <ProtectedRoute allowedRoles={appRoles}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />

        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <StaffManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/addmissions"
          element={
            <ProtectedRoute allowedRoles={["admin", "reception", "nurse", ]}>
              <Addmissions />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patients"
          element={
            <ProtectedRoute allowedRoles={["admin", "doctor", "reception"]}>
              <Patients />
            </ProtectedRoute>
          }
        />

        <Route
          path="/appointments"
          element={
            <ProtectedRoute allowedRoles={["admin", "reception"]}>
              <Appointments />
            </ProtectedRoute>
          }
        />

        <Route
          path="/lab"
          element={
            <ProtectedRoute allowedRoles={["admin", "lab", "doctor"]}>
              <Lab />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pharmacy"
          element={
            <ProtectedRoute allowedRoles={["admin", "pharmacy"]}>
              <Pharmacy />
            </ProtectedRoute>
          }
        />

        <Route
          path="/billing"
          element={
            <ProtectedRoute allowedRoles={["admin", "reception"]}>
              <Billing />
            </ProtectedRoute>
          }
        />

        <Route
          path="/consultations"
          element={
            <ProtectedRoute allowedRoles={["admin", "reception", "nurse", "doctor"]}>
              <Consultations />
            </ProtectedRoute>
          }
        />

        {/* TASKS — all roles */}
      <Route
        path="/notifications"
        element={
          <ProtectedRoute allowedRoles={["admin", "doctor", "nurse", "lab", "pharmacy", "reception"]}>
            <Notifications />
          </ProtectedRoute>
        }
      />

      {/* REPORTS — admin */}
      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Reports />
          </ProtectedRoute>
        }
      />
      </Route>

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}