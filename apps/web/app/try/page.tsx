import { permanentRedirect } from "next/navigation";

/** The demo-shop picker was retired: Walrus Market lists every shop. Old links land there. */
export default function TryPage() {
  permanentRedirect("/market");
}
