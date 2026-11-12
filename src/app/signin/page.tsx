import { Suspense } from "react";
import SignInClient from "./SignInClient";

// Account sign-in. Nothing on the site requires it yet (phase 1): the account exists so that, once
// reveals are logged, every number taken out of the directory has a name behind it.
export default function SignInPage() {
  return (
    <Suspense>
      <SignInClient />
    </Suspense>
  );
}
