/** هياكل تحميل (skeleton) بنفس أبعاد الكروت الحقيقية عشان الصفحة متتنططش لما البيانات توصل. من غير 'use client' عشان تتستخدم في loading.tsx. */

export function ProductCardSkeleton() {
  return (
    <div className="card skel-card" aria-hidden="true">
      <div className="card-media skel" />
      <div className="card-body">
        <span className="skel skel-line short" />
        <span className="skel skel-line" />
        <span className="skel skel-line half" />
        <span className="skel skel-btn" />
      </div>
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid" role="status" aria-label="جاري تحميل المنتجات">
      {Array.from({ length: count }, (_, index) => <ProductCardSkeleton key={index} />)}
    </div>
  )
}

/** هيكل الصفحة الرئيسية: هيدر + هيرو + شبكة منتجات */
export function HomeSkeleton() {
  return (
    <>
      <div className="header skel-header" aria-hidden="true">
        <div className="header-in"><span className="skel skel-logo" /><span className="skel skel-search" /></div>
      </div>
      <section className="hero" aria-hidden="true">
        <div className="hero-in">
          <div className="hero-copy">
            <span className="skel skel-line" style={{ width: '70%', height: 36 }} />
            <span className="skel skel-line" style={{ width: '50%', height: 36 }} />
            <span className="skel skel-line half" />
            <span className="skel skel-btn" style={{ width: 160 }} />
          </div>
          <div className="hero-art skel" />
        </div>
      </section>
      <section className="section"><ProductGridSkeleton count={8} /></section>
    </>
  )
}

/** هيكل صفحة المنتج */
export function ProductPageSkeleton() {
  return (
    <>
      <div className="header skel-header" aria-hidden="true">
        <div className="header-in"><span className="skel skel-logo" /></div>
      </div>
      <div className="pp" role="status" aria-label="جاري تحميل المنتج">
        <div className="pview">
          <div className="pview-media skel" />
          <div className="pview-info">
            <span className="skel skel-line short" />
            <span className="skel skel-line" style={{ height: 32 }} />
            <span className="skel skel-line half" style={{ height: 28 }} />
            <span className="skel skel-line" style={{ height: 120 }} />
            <span className="skel skel-btn" />
          </div>
        </div>
      </div>
    </>
  )
}
