import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ locals }) => {
  if (!locals.session) {
    redirect(302, "/sign-in");
  }
  return {
    user: locals.user,
    session: locals.session,
  };
};
