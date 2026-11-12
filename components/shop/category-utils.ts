import type { Category, Product } from './types'

export type CategoryNode = Category & { children: Category[] }

export function buildTree(categories: Category[]): CategoryNode[] {
  return categories
    .filter((category) => !category.parentId)
    .map((top) => ({ ...top, children: categories.filter((child) => child.parentId === top.id) }))
}

/** عدد المنتجات في كل قسم (القسم الرئيسي بيجمع الفرعيين) */
export function countByCategory(categories: Category[], products: Product[]) {
  const parentOf = new Map(categories.map((category) => [category.id, category.parentId]))
  const counts: Record<string, number> = {}
  for (const product of products) {
    if (!product.categoryId) continue
    counts[product.categoryId] = (counts[product.categoryId] ?? 0) + 1
    const parent = parentOf.get(product.categoryId)
    if (parent) counts[parent] = (counts[parent] ?? 0) + 1
  }
  return counts
}

export function categoryMatcher(categories: Category[], selected: string | null) {
  if (!selected) return () => true
  const ids = new Set<string>([selected])
  for (const category of categories) if (category.parentId === selected) ids.add(category.id)
  return (product: Product) => Boolean(product.categoryId && ids.has(product.categoryId))
}

export function categoryPath(categories: Category[], id: string | null | undefined) {
  if (!id) return 'من غير قسم'
  const category = categories.find((item) => item.id === id)
  if (!category) return 'من غير قسم'
  const parent = category.parentId ? categories.find((item) => item.id === category.parentId) : null
  return parent ? `${parent.name} › ${category.name}` : category.name
}

export function categoryIcon(categories: Category[], id: string | null | undefined) {
  return categories.find((item) => item.id === id)?.icon ?? '🛍️'
}

/** صورة القسم = صورة منتج فعلي من القسم (أو أقسامه الفرعية). مفيش صور مولّدة. */
export function categoryCover(categories: Category[], products: Product[], id: string): string | null {
  const ids = new Set<string>([id])
  for (const category of categories) if (category.parentId === id) ids.add(category.id)
  const withImage = products.filter((product) => product.categoryId && ids.has(product.categoryId) && product.imageUrl)
  return (withImage.find((product) => product.stock > 0) ?? withImage[0])?.imageUrl ?? null
}
