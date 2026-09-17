import Image from "next/image";

export function InfrastructureSection() {
  return (
    <section className="mt-[-51px] pb-20 min-[1800px]:mt-0 md:pb-28">
      <div className="relative mx-auto w-[85%] border border-white/10 px-8 pt-8 pb-14 min-[1800px]:w-[1722px] md:px-16 md:pt-10 md:pb-20">
        <div className="flex flex-col items-center gap-16 md:flex-row">
          <div className="text-left md:flex-1">
            <div className="mb-6 flex items-center gap-3">
              <Image src="/herosection/Subtract.svg" alt="" width={58} height={26} aria-hidden="true" />
              <span className="font-heading text-[22px] leading-none font-light tracking-[-0.02em] text-white/70">
                Infrastructure Freedom
              </span>
            </div>

            <h2 className="max-w-[950px] font-heading text-[136px] leading-[1.05] font-bold text-foreground">
              You came here to build.
            </h2>

            <p className="mt-6 max-w-[860px] font-heading text-[32px] text-white/70">
              Your next feature. Your first customer. The idea you can&apos;t stop thinking about.
              usectl handles the infrastructure, giving you more time to move your product forward
            </p>
          </div>

          <div className="shrink-0">
            <Image
              src="/infrastructur/servertitanium.svg"
              alt=""
              width={568}
              height={556}
              aria-hidden="true"
              className="mt-[100px] h-auto w-[260px] md:max-[1799px]:w-[320px] min-[1800px]:w-[650px]"
            />
          </div>
        </div>

        <Image
          src="/infrastructur/static.svg"
          alt=""
          width={821}
          height={35}
          aria-hidden="true"
          className="mt-16 h-auto w-full max-w-[821px] md:mt-20"
        />
      </div>
    </section>
  );
}
