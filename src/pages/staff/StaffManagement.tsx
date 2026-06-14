import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Staff = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  specialization: string;
  department: string;
  status: string;
};

export default function StaffManagement() {
  const [staff, setStaff] = useState<Staff[]>([]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "doctor",
    specialization: "",
    department: "",
    password: "",
  });

  // 📌 FETCH STAFF
  const fetchStaff = async () => {
    const { data } = await supabase
      .from("staff")
      .select("*")
      .order("created_at", { ascending: false });

    setStaff(data || []);
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // 📌 SIMPLE ID GENERATOR (DOC-001 style)
  const generateId = (role: string) => {
    const prefix =
      role === "doctor"
        ? "DOC"
        : role === "nurse"
        ? "NUR"
        : role === "pharmacy"
        ? "PHA"
        : role === "lab"
        ? "LAB"
        : role === "admin"
        ? "ADM"
        : "REC";

    const random = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${random}`;
  };

  // 📌 CREATE STAFF
  const createStaff = async () => {
    // 1. Create Auth User
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    const user = data.user;

    if (!user) return;

    const staffId = generateId(form.role);

    // 2. Insert into staff table
    const { error: dbError } = await supabase.from("staff").insert([
      {
        id: staffId,
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: form.role,
        specialization: form.specialization,
        department: form.department,
        status: "Off Duty",
        password_hash: "supabase_auth",
      },
    ]);

    if (dbError) {
      alert(dbError.message);
      return;
    }

    alert("Staff created successfully!");

    setForm({
      name: "",
      email: "",
      phone: "",
      role: "doctor",
      specialization: "",
      department: "",
      password: "",
    });

    fetchStaff();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Staff Management</h1>

      {/* FORM */}
      <div className="bg-white border p-4 grid grid-cols-2 gap-3 rounded-xl">
        <input
          placeholder="Full Name"
          className="border p-2"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <input
          placeholder="Email"
          className="border p-2"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <input
          placeholder="Phone"
          className="border p-2"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />

        <input
          type="password"
          placeholder="Password"
          className="border p-2"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        <select
          className="border p-2"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="admin">Admin</option>
          <option value="doctor">Doctor</option>
          <option value="nurse">Nurse</option>
          <option value="pharmacy">Pharmacy</option>
          <option value="lab">Lab</option>
          <option value="reception">Reception</option>
        </select>

        <input
          placeholder="Specialization"
          className="border p-2"
          value={form.specialization}
          onChange={(e) =>
            setForm({ ...form, specialization: e.target.value })
          }
        />

        <input
          placeholder="Department"
          className="border p-2"
          value={form.department}
          onChange={(e) =>
            setForm({ ...form, department: e.target.value })
          }
        />

        <button
          onClick={createStaff}
          className="bg-blue-600 text-white p-2 col-span-2 rounded"
        >
          Create Staff
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Name</th>
              <th className="p-3">Role</th>
              <th className="p-3">Department</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>

          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-3">{s.id}</td>
                <td className="p-3">{s.name}</td>
                <td className="p-3">{s.role}</td>
                <td className="p-3">{s.department}</td>
                <td className="p-3">{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}