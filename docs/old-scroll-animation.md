# Old scroll animation — scrub-ზე მიბმული ვერსია (შენახულია აღსადგენად)

ეს ფაილი ინახავს pinned hero-ს **ძველ ქცევას**, სადაც ანიმაციები პირდაპირ scroll-ს
მიჰყვებოდა (scrub) — 2026-09-28-მდე/დღეს ასე მუშაობდა, სანამ fullpage/onepage
დრაივერზე გადავიდოდით (იხ. PROJECT.md "Polish pass 3-5"). თუ ოდესმე დაბრუნება
მოგინდება, ქვემოთ ზუსტი კოდი და ნაბიჯებია.

ყველა ცვლილება ერთ ფაილშია: `src/components/sections/HeroSectionClient.tsx`.

---

## ვერსია A — სუფთა scrub (ყველაზე დიდხანს ნამუშევარი ვერსია)

ანიმაცია პიქსელ-პიქსელ მიჰყვება scroll-ს: ბორბალს რომ აჩერებ, ანიმაციაც ზუსტად
იმ ადგილას იყინება; უკან scroll-ზე იდენტურად უკუიქცევა. სექცია pin-დება
`PIN_SCROLL_DISTANCE`-ის მანძილზე.

Timeline ასე იქმნებოდა (ახლანდელი `gsap.timeline({ paused: true })`-ის ნაცვლად):

```ts
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: section,
    // სექციის თავი ყოველთვის ზუსტად header-ის ქვეშ ზის, ამიტომ pin პირველივე
    // დასქროლილი პიქსელიდან აქტიურია
    start: () => `top ${HEADER_HEIGHT_PX}px`,
    end: `+=${PIN_SCROLL_DISTANCE}`,
    scrub: true,
    pin: true,
    // აუცილებლად ექსპლიციტური: <main> display:flex-ია, რაც GSAP-ის ავტომატურ
    // pin spacing-ს ჩუმად თიშავს (PROJECT.md-შია დოკუმენტირებული)
    pinSpacing: true,
    invalidateOnRefresh: true,
  },
});
```

### აღდგენის ნაბიჯები (ახლანდელი კოდიდან)

1. `const tl = gsap.timeline({ paused: true });` შეცვალე ზემოთა ბლოკით.
2. წაშალე მთელი **"fullpage transition engine"** სექცია:
   - `TRANSITION_SECONDS`, `LAST`, `stateIndex`, `transitioning`, `pinST`, `goToState`
   - `pinST = ScrollTrigger.create({ ... onUpdate ... })` (pin-ი ისევ timeline-ის
     scrollTrigger-იდან მოვა)
   - მთელი `onWheel` ჰენდლერი და მისი `window.addEventListener("wheel", ...)`
   - `onRefresh` ლისენერი (`tl.invalidate()` — ამას scrub-ის `invalidateOnRefresh`
     თავად აკეთებს)
   - ეფექტის ბოლოს `return () => { ... }` cleanup-ი
3. `SNAP_TIMES` მასივი შეგიძლია დატოვო (უვნებელია) ან წაშალო.
4. ruler-ის მწვანე შევსების tween-ი უცვლელი რჩება — ის timeline-შია და scrub-შიც
   ისევე მუშაობს (scroll-ის პროპორციულად ივსება).

---

## ვერსია B — scrub + snap ("fullpage-ის მსგავსი", ერთი შუალედური დღეც იმუშავა)

იგივე scrub, ოღონდ scroll-ის გაჩერებისას გვერდი თავად მიცურდებოდა უახლოეს
"ჩამჯდარ" state-მდე. **უარყოფილ იქნა**: trackpad-ის ინერციის გამო ქვემოთ
სქროლვისას ხანდახან უკან (ზემოთ) აბრუნებდა.

ვერსია A-ს scrollTrigger-ს ემატებოდა:

```ts
    scrub: 1, // 1 წამის "დაწევნის" სიგლუვე მყარი true-ს ნაცვლად
    snap: {
      snapTo: "labels",
      duration: { min: 0.4, max: 1.1 },
      delay: 0.08,
      ease: "power2.inOut",
    },
```

და ყველა state-ის აწყობის შემდეგ (ruler-ის tween-ამდე) — label-ები თითო
"ჩამჯდარ" წერტილზე:

```ts
const SNAP_TIMES = [0, 1.1, 2.3, 4.25, 5.95, 8.8, 11.2, 12.6, tl.totalDuration()];
SNAP_TIMES.forEach((t, i) => tl.addLabel(`state-${i + 1}`, t));
```

---

## საერთო ცნობები ორივე ვერსიისთვის

- `SNAP_TIMES`-ის მნიშვნელობები თითო state-ის "hold"-ის შუა წერტილებია timeline-ის
  ერთეულებში; თუ state-ების ტაიმინგი შეიცვლება, ესენიც თავიდან უნდა გამოითვალოს
  (სრული ტაიმინგი PROJECT.md-შია).
- `PIN_SCROLL_DISTANCE = 12800` (ამ დოკუმენტის დაწერისას) — scrub-ის დროს ეს
  განსაზღვრავს "რამდენ scroll-ს მოიხმარს" მთელი სცენა; timeline-ის 1 ერთეული ≈
  920px scroll.
- reduced-motion ქცევა ორივე არქიტექტურაში ერთია: ეფექტი ადრე ბრუნდება, hero
  სტატიკურად state 1-ზე რჩება.
- SSR reserve spacer-ი (სექციის მომდევნო sibling-ი) ორივეგან საჭიროა და უცვლელია.
