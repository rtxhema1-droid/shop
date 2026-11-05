export type Role = 'owner' | 'vendor' | 'user'
export type SessionUser = {
  id: string
  name: string
  username: string
  email: string | null
  role: Role
  phone: string | null
  storeName: string | null
}
export type Category = { id: string; name: string; parentId: string | null; icon: string; sortOrder: number }
export type Product = {
  id: string
  name: string
  description: string
  priceCents: number
  oldPriceCents: number | null
  stock: number
  categoryId: string | null
  imageUrl: string | null
  vendorId: string
  storeName: string
  updatedAt: string
  battery?: string | null
  warranty?: string | null
  boxContents?: string | null
  active?: boolean
  commissionPercent?: number
}
export type Zone = { id: string; name: string; shippingFeeCents: number; deliveryDaysMin?: number | null; deliveryDaysMax?: number | null }
export type OrderItem = { productId: string; name: string; quantity: number; unitPriceCents: number; commissionPercent?: number }
export type Order = {
  id: string
  status: 'new' | 'accepted' | 'rejected' | 'delivered'
  customerName: string
  customerPhone: string
  deliveryAddress: string
  zoneName: string
  notes: string
  subtotalCents: number
  shippingFeeCents: number
  createdAt: string
  deliveredAt: string | null
  customerVerification: 'pending' | 'confirmed' | 'disputed'
  storeName: string
  vendorName: string
  items: OrderItem[]
  commissionCents?: number
}
export type Vendor = { id: string; name: string; username: string; phone: string; storeName: string; storeAddress: string; createdAt: string; permissions: string[] }
export type Notice = { id: string; orderId: string | null; kind: string; title: string; body: string; readAt: string | null; createdAt: string }
export type LedgerRow = { id: string; orderId: string; amountCents: number; description: string; createdAt: string }
export type Dashboard = {
  orders: Order[]
  stats: { total: number; pending: number; accepted: number; delivered: number; salesCents: number }
  commissionTotalCents: number
  products: Product[]
  vendors: Vendor[]
  sellers: Array<{ id: string; storeName: string }>
  wallet: { balanceCents: number } | null
  ledger: LedgerRow[]
  notifications: Notice[]
  unreadCount: number
  permissions: string[]
  weakOwnerPassword?: boolean
}
export type Catalog = { categories: Category[]; products: Product[]; zones: Zone[] }
export type CartMap = Record<string, number>
