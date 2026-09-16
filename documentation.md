# Premium Scroll-Driven Landing Page

## Technical Specification & Development Guidelines

## 1. Project Goal

Build a premium, highly interactive landing page inspired by modern product websites such as Apple and high-quality creative websites such as Anime.js.

The primary goal is to create a visually impressive **scroll-driven storytelling experience**.

The page should not feel like a collection of unrelated animations.

Animations must form a coherent timeline controlled by the user's scroll position.

Example experience:

```text
User scrolls
    ↓
Section becomes pinned
    ↓
Product appears
    ↓
Product transforms / rotates / opens
    ↓
Camera or viewport moves
    ↓
Text appears
    ↓
Product changes position
    ↓
Next feature is revealed
    ↓
Section releases
    ↓
Next section begins
```

The result should feel premium, smooth, intentional and technically clean.

---

# 2. Technology Stack

Use the following stack unless there is a strong technical reason to change it:

### Core

* Next.js
* TypeScript
* React
* App Router

### Styling

* Tailwind CSS
* CSS Modules when component-specific CSS is more appropriate

### Animation

* GSAP
* GSAP ScrollTrigger
* `@gsap/react`

### Optional smooth scrolling

* Lenis

Do NOT introduce Lenis immediately unless native scrolling + ScrollTrigger produces a real UX problem.

### 3D

Use only if the design actually requires 3D:

* Three.js
* React Three Fiber
* @react-three/drei

Do not introduce Three.js just because it is available.

---

# 3. Core Architectural Principle

Separate the application into three conceptual layers:

```text
UI / Content
      ↓
Animation orchestration
      ↓
Optional 3D rendering
```

Do not mix all three layers into one huge React component.

Example:

```text
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── components/
│   ├── layout/
│   ├── sections/
│   ├── ui/
│   └── animations/
│
├── animations/
│   ├── hero.ts
│   ├── product.ts
│   ├── features.ts
│   └── utils.ts
│
├── scenes/
│   └── ProductScene.tsx
│
├── hooks/
│   └── useScrollAnimation.ts
│
├── lib/
│   └── ...
│
└── types/
    └── ...
```

The exact structure can change if there is a better architectural solution, but avoid unnecessary complexity.

---

# 4. Next.js Architecture

Use the App Router.

Prefer Server Components by default.

Only use `"use client"` where browser-side functionality is actually required.

For example:

```text
Server Components
├── page
├── static content
├── SEO metadata
├── product information
└── semantic HTML

Client Components
├── GSAP animations
├── ScrollTrigger
├── interactive UI
└── Three.js / React Three Fiber
```

Do NOT make the entire page a Client Component without a reason.

Avoid:

```tsx
"use client";

export default function EntirePage() {
   // everything here
}
```

if the majority of the page is static content.

---

# 5. SEO Requirements

The landing page must be SEO-friendly.

Use Next.js Metadata API.

Include:

* title
* description
* Open Graph metadata
* Twitter/X metadata where appropriate
* canonical URL when applicable
* semantic HTML
* proper heading hierarchy

The animation layer must not be required for the user to understand the core content.

Important content should exist as real HTML text.

Do not render important SEO content exclusively inside Canvas/WebGL.

Example:

```text
<h1>Product headline</h1>

<p>
  Product description...
</p>
```

The animation should enhance the content rather than replace it.

---

# 6. Animation Philosophy

GSAP + ScrollTrigger is the primary animation system.

Use timelines instead of many unrelated ScrollTriggers whenever multiple animations belong to the same storytelling sequence.

Example:

```tsx
const timeline = gsap.timeline({
  scrollTrigger: {
    trigger: section,
    start: "top top",
    end: "+=3000",
    scrub: 1,
    pin: true,
  },
});

timeline
  .to(...)
  .to(...)
  .to(...)
  .to(...);
```

The timeline should represent the progression of the story.

Avoid creating dozens of independent ScrollTriggers when a single timeline would be clearer.

---

# 7. Scroll-Driven Sections

For major product storytelling sections, use the following pattern:

```text
section
   ↓
pin
   ↓
long scroll distance
   ↓
GSAP timeline
   ↓
scrub
```

Example conceptual behavior:

```text
0% scroll
Product is closed

20%
Product begins opening

40%
Product fully opens

60%
Camera/viewport moves

75%
Feature text appears

100%
Section completes
```

The animation should respond smoothly to both slow and fast scrolling.

The user must be able to scroll backward and see the animation reverse naturally.

Do not create animations that only work correctly when scrolling downward.

---

# 8. React + GSAP

Use `@gsap/react` and `useGSAP` where appropriate.

Example:

```tsx
useGSAP(
  () => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top top",
        end: "+=2500",
        scrub: 1,
        pin: true,
      },
    });

    tl.to(...);
  },
  {
    scope: sectionRef,
  }
);
```

Always consider cleanup and React lifecycle behavior.

Do not create global GSAP animations that survive component unmount unless intentionally designed that way.

---

# 9. Animation Responsibilities

Animation code should not be scattered randomly throughout JSX.

Prefer:

```text
components/
    ProductSection.tsx

animations/
    productAnimation.ts
```

Then the React component owns DOM references and lifecycle while the animation module owns the animation sequence.

Example:

```tsx
useProductAnimation({
  section,
  product,
  title,
});
```

The implementation may differ, but the separation of responsibilities should remain clear.

---

# 10. 3D Architecture

Only use React Three Fiber when the design genuinely requires a 3D object or scene.

Example:

```text
ProductSection
      ↓
ProductScene
      ↓
Canvas
      ↓
ProductModel
      ↓
Camera
      ↓
Lights
```

Keep 3D rendering separate from normal DOM content.

Avoid putting the entire page inside `<Canvas>`.

Prefer:

```text
DOM
├── Navbar
├── Hero
├── ProductSection
│      ├── DOM text
│      └── Canvas
├── Features
└── Footer
```

rather than:

```text
Canvas
└── Entire website
```

unless there is a specific reason.

---

# 11. 3D Animation

For 3D objects, animation values should be driven by a clear source of truth.

Possible architecture:

```text
ScrollTrigger
      ↓
progress
      ↓
animation timeline
      ↓
3D object transforms
      ↓
render
```

For example:

```text
scroll progress: 0 → 1

laptop rotation:
0deg → 110deg

camera:
far → near

product position:
center → left
```

Avoid manually attaching dozens of independent scroll listeners.

Prefer GSAP's timeline/progress system.

---

# 12. Performance

Performance is a first-class requirement.

Target:

```text
Desktop:
smooth interaction

Mobile:
acceptable smoothness without destroying battery/performance
```

Avoid unnecessary React re-renders during animations.

Do NOT do this for high-frequency animation:

```tsx
setState(scrollPosition);
```

for every scroll frame unless there is a very specific reason.

Prefer GSAP transforms.

Prefer GPU-friendly properties:

```text
transform
opacity
```

Be careful with:

```text
width
height
top
left
margin
```

when animated continuously because they can cause layout work.

---

# 13. Images and Assets

Optimize all assets.

Use Next.js image optimization where applicable.

For 3D models:

* optimize polygon count
* compress textures
* use appropriate texture resolution
* lazy-load when possible
* avoid huge unnecessary GLTF/GLB files

Do not load a 30 MB model just because it looks slightly better.

---

# 14. Responsive Animation

Desktop and mobile must not blindly use identical animation values.

Design responsive behavior intentionally.

Example:

```text
Desktop:
large product
long camera movement
complex composition

Mobile:
smaller product
shorter camera movement
simplified effects
```

Use `gsap.matchMedia()` when appropriate.

Example:

```tsx
const mm = gsap.matchMedia();

mm.add("(min-width: 768px)", () => {
  // desktop animation
});

mm.add("(max-width: 767px)", () => {
  // mobile animation
});
```

Do not simply scale desktop animation down and assume it will work.

---

# 15. Accessibility

Respect:

```css
prefers-reduced-motion
```

Users who prefer reduced motion should receive a simplified experience.

Core content must remain accessible without animation.

Do not make important information dependent on animation timing.

Keyboard navigation must continue to work normally.

---

# 16. Component Design

Avoid giant components.

Bad:

```text
LandingPage.tsx
├── 1000 lines
├── all GSAP logic
├── all JSX
├── all responsive logic
└── all 3D logic
```

Prefer:

```text
LandingPage
├── Navbar
├── HeroSection
├── ProductStorySection
├── FeatureSection
├── CTASection
└── Footer
```

Each major section should own its content and behavior.

---

# 17. Animation Naming

Use descriptive names.

Good:

```text
createHeroTimeline()
createProductOpeningTimeline()
createFeatureRevealTimeline()
createCameraSequence()
```

Bad:

```text
animate1()
animation2()
doStuff()
```

Variables should describe what they represent:

```text
productRef
sectionRef
cameraRef
titleRef
featureRefs
```

---

# 18. Avoid Overengineering

Do not introduce libraries unless they solve an actual problem.

Do not install:

```text
5 animation libraries
3 state management libraries
multiple smooth-scroll libraries
unnecessary UI frameworks
```

Preferred animation stack:

```text
GSAP
ScrollTrigger
```

Optional:

```text
Lenis
Three.js
React Three Fiber
```

Only when justified.

---

# 19. Development Process

Do NOT immediately generate the entire project.

Follow this sequence.

## Phase 1 — Analyze

First inspect the project and determine:

* current Next.js version
* React version
* TypeScript configuration
* Tailwind setup
* existing dependencies
* folder structure
* existing components
* existing styling conventions

Do not overwrite existing architecture without understanding it.

---

## Phase 2 — Architecture Proposal

Before implementing major changes, provide:

```text
1. Proposed architecture
2. Folder structure
3. Dependencies to install
4. Why each dependency is needed
5. Animation strategy
6. SEO strategy
7. Performance strategy
8. Responsive strategy
```

Then implement.

Do not ask for confirmation for every tiny step, but pause if a major architectural decision has multiple materially different solutions.

---

## Phase 3 — Build Foundation

Implement:

```text
Next.js structure
SEO metadata
layout
global styles
main sections
basic responsive layout
```

No complex animations yet.

---

## Phase 4 — Implement Animation System

Create reusable animation utilities/hooks.

Then implement the first major scroll-driven sequence.

Do not build every animation at once.

First prove:

```text
pin
+
scrub
+
timeline
+
reverse scrolling
+
responsive behavior
```

---

## Phase 5 — 3D

Only after the DOM animation architecture is stable, introduce Three.js/R3F if required.

Build the 3D scene independently first.

Then connect it to the scroll timeline.

---

## Phase 6 — Performance Pass

After functionality works:

Check:

* unnecessary re-renders
* layout shifts
* image size
* model size
* texture size
* GPU usage
* scroll performance
* mobile performance
* animation cleanup
* memory leaks

---

# 20. Code Quality Rules

Use strict TypeScript.

Avoid:

```tsx
any
```

unless there is a documented reason.

Avoid unnecessary abstractions.

Avoid unnecessary `useMemo`.

Avoid unnecessary `useCallback`.

Do not create custom hooks merely to move 5 lines of code somewhere else.

Abstractions should solve real complexity.

---

# 21. GSAP Rules

Do not animate React state when GSAP can directly animate the DOM.

Prefer:

```text
GSAP → transform/opacity
```

instead of:

```text
scroll → setState → React render → DOM update
```

Use refs for animation targets.

Use scoped GSAP contexts.

Clean up ScrollTriggers correctly.

Avoid duplicate ScrollTriggers caused by React development lifecycle.

---

# 22. Debugging Rules

When an animation behaves incorrectly:

First inspect:

```text
1. Trigger position
2. Start/end values
3. Pin behavior
4. Timeline progress
5. Element dimensions
6. Transform origin
7. Responsive breakpoint
8. React lifecycle
9. ScrollTrigger refresh
```

Do not randomly change numbers until the animation works.

Find the actual cause.

---

# 23. Browser Compatibility

Test at minimum:

```text
Chrome
Safari
Firefox
```

Pay particular attention to Safari because the target design is heavily animation-driven.

Test:

```text
Desktop
Tablet
Mobile
```

---

# 24. Mobile Strategy

Mobile is not simply "desktop but smaller".

If a complex animation causes poor performance on mobile:

simplify the animation.

Possible mobile fallback:

```text
Desktop:
3D object + camera animation + multiple transitions

Mobile:
simplified 3D movement or static image + basic transitions
```

Preserve the storytelling rather than forcing every desktop effect onto mobile.

---

# 25. Visual Quality

Animations should have:

* intentional easing
* consistent timing
* smooth transitions
* meaningful movement
* visual hierarchy
* controlled spacing

Avoid excessive:

```text
bounce
rotation
scale
blur
parallax
```

just because they are technically possible.

Every animation should have a purpose.

---

# 26. Important Rule: Do Not Copy Apple

The visual goal is:

```text
premium
minimal
cinematic
interactive
product-focused
```

Apple can be used as inspiration for interaction patterns, but do not copy proprietary assets, branding, exact layouts or distinctive visual designs.

Create an original visual identity.

---

# 27. Expected AI Behavior

You are acting as a senior frontend engineer and technical architect.

Your responsibilities:

* make architectural decisions
* keep the code maintainable
* explain important decisions
* identify technical risks
* avoid unnecessary dependencies
* consider performance
* consider SEO
* consider accessibility
* consider responsive behavior

Do not blindly follow the easiest implementation.

If there are multiple approaches, compare them briefly and choose the approach that best fits the project.

Do not introduce complexity without justification.

---

# 28. Before Writing Code

First inspect the repository.

Then produce a short technical plan:

```text
Current architecture:
...

Problems:
...

Proposed architecture:
...

Dependencies:
...

Animation strategy:
...

SEO strategy:
...

Performance risks:
...

Implementation order:
...
```

Then begin implementation.

---

# 29. Review Checklist

Before considering a feature complete, verify:

### Architecture

* [ ] Components have clear responsibilities
* [ ] Animation logic is not unnecessarily mixed with UI
* [ ] 3D logic is isolated
* [ ] No unnecessary dependencies

### Next.js

* [ ] App Router used correctly
* [ ] Server Components used where appropriate
* [ ] Client Components limited to interactive areas
* [ ] Metadata configured

### Animation

* [ ] ScrollTrigger cleanup works
* [ ] Reverse scrolling works
* [ ] Timeline is understandable
* [ ] Pinning works
* [ ] No duplicate ScrollTriggers
* [ ] Mobile behavior is intentional

### Performance

* [ ] No unnecessary React renders
* [ ] Assets optimized
* [ ] 3D models optimized
* [ ] Images optimized
* [ ] Animations primarily use transform/opacity
* [ ] Mobile performance considered

### Accessibility

* [ ] Reduced motion considered
* [ ] Content remains accessible without animation
* [ ] Keyboard navigation works
* [ ] Semantic HTML used

### Code Quality

* [ ] No unnecessary `any`
* [ ] No unnecessary `useMemo`
* [ ] No unnecessary `useCallback`
* [ ] No giant components
* [ ] No duplicated animation logic
* [ ] Naming is clear

---

# 30. Final Principle

The project should feel like:

```text
A high-end interactive product website
```

not:

```text
A normal React website with lots of animations
```

The animation system should support the visual story.

Architecture should remain understandable to another senior developer.

Performance should be treated as part of the design.

SEO should remain independent from the animation layer.

The final implementation should be impressive visually while remaining maintainable technically.
