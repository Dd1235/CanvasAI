import { signout } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <form action={signout}>
      <Button type="submit" variant="ghost" size="sm">
        <LogOut className="mr-2 size-4" />
        Log out
      </Button>
    </form>
  );
}
