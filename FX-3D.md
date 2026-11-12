# طبقة الـ 3D (RTX SHOP)

## الرحلة
1. **Preloader** بعدّاد % ← **عرض سينمائي** (600vh): نجمة كروم + مكعبات (متبعثرة ← كورة ← حلقة) + سلسلة بتتحرك مع السكرول + كروت عايمة + تغيّر ألوان لكل قسم.
2. زر **دخول المتجر** ← غمرة داخل النجمة ← **لمبة 3D والسلسلة ملفوفة حواليها**. شدّ الخيط (أو الزر) يشغّل النور ويفتح نموذج الدخول/التسجيل.
3. بعد الدخول: **رسالة ترحيب** بسلسلة وبادج باسم العميل بتنزل من فوق، وبعدها الستارة تطلع ويدخل المتجر بحركة عمق (stagger).
4. في المتجر: كروت بتميل 3D مع المؤشر، سلسلة بتعدّي مع سرعة السكرول، و**انفجار كرستالات** عند الوصول لقسم المنتجات وكرستالات طايرة بباراللاكس.

## الملفات
- `lib/fx/kit.ts` المسرح، الـ HDRI الـ procedural، النجمة (shader التحطم)، المكعبات، السلسلة (InstancedMesh على CatmullRomCurve3).
- `lib/fx/promo-scene.ts` الألوان لكل قسم + المسارات + الكروت + البادج. `lamp-scene.ts` اللمبة. `welcome-scene.ts` الترحيب.
- `components/fx/gate-experience.tsx` الـ master timeline (GSAP + ScrollTrigger + Lenis) + الكرسر + اللمبة.
- `components/fx/welcome-drop.tsx` · `store-motion.tsx` · `gate-switch.tsx` · `app/fx.css`.

## الأداء وإمكانية الوصول
- DPR بحد أقصى 2 (1.5 موبايل). موبايل (<768px): من غير bloom/motion-blur، سلسلة ومكعبات أقل.
- `prefers-reduced-motion` أو من غير WebGL ← بيرجع لشاشة الدخول العادية وكارت الترحيب القديم.
- three/gsap/lenis بتتحمّل lazy (dynamic import) وبس لما تحتاجها.
- تغيير ألوان الأقسام/الكاميرا: `THEME_DEFS` وكتلة `buildMaster` في `gate-experience.tsx`.
- النجمة procedural؛ لو عايز موديل `.glb` مضغوط Draco استبدل `buildStar()` بـ GLTFLoader + DRACOLoader.
