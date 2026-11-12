import { Suspense } from "react";
import RegisterClient from "./RegisterClient";

// One door for everyone: this page opens an account, and listing yourself as a donor is a tick box
// on it. Someone looking for blood should not have to join the directory to search it.
export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterClient />
    </Suspense>
  );
}
