import Link from 'next/link'
import { PackageSearch } from 'lucide-react'

export default function ProductNotFound() {
  return (
    <main className="setup-notice">
      <PackageSearch aria-hidden="true" />
      <h1>المنتج ده مش موجود</h1>
      <p>ممكن يكون اتشال من المتجر أو الرابط فيه غلطة.</p>
      <Link className="btn btn-primary" href="/">ارجع للمتجر</Link>
    </main>
  )
}
