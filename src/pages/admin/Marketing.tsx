import { Outlet } from "react-router-dom";

export default function Marketing() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Marketing</h1>
      <Outlet />
    </div>
  );
}
