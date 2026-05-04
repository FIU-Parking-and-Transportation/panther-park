import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ locals }) => {
  const role = locals.user?.role;
  if (role !== "admin" && role !== "staff") {
    redirect(302, "/dashboard");
  }
  return {};
};
