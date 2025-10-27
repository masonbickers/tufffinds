// src/app/_components/footer.tsx (or components/Footer.tsx)
import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <Image
          src="/logo-04.png"
          alt="Tufffinds"
          width={72}
          height={72}
          className="footer__logo"
          priority
        />

        <nav className="footer__nav" aria-label="Footer navigation">
          <Link href="/about">ABOUT</Link>
          <Link href="/services">SERVICES</Link>
          <Link href="/founders">FOUNDERS</Link>
          <Link href="/guest-list">CONTACT</Link>
          <Link href="/contact">T&amp;C</Link>

          <a
            href="https://instagram.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
            className="ig"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zm0 2a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm5-2.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z"
                fill="currentColor"
              />
            </svg>
          </a>
        </nav>

        <small className="footer__copy">TUFFFINDS 2025. ALL RIGHTS RESERVED</small>
      </div>

      <style jsx global>{`
        .footer {
          background: #f8f7f3;
          color: #000000ff;
          width: 100%;
        }

        .footer__inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 56px 24px 28px;
          text-align: center;
        }

        .footer__logo {
          width: 72px;
          height: auto;
          display: block;
          margin: 0 auto 28px;
          filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.08));
        }

        .footer__nav {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 30px;
          margin-bottom: 28px;
          letter-spacing: 0.06em;
        }

        .footer__nav a {
          color: #000000ff;
          text-decoration: none;
          font-weight: 600;
          font-size: 10px;
          opacity: 0.9;
        }

        .footer__nav a:hover {
          opacity: 1;
          text-decoration: underline;
        }

        .footer__nav .ig {
          display: inline-flex;
          align-items: center;
        }

        .footer__copy {
          display: block;
          opacity: 0.9;
          font-size: 8px;
          letter-spacing: 0.08em;
        }

        @media (max-width: 640px) {
          .footer__logo {
            width: 60px;
            margin-bottom: 10px;
          }
          .footer__nav {
            gap: 18px;
          }
        }
      `}</style>
    </footer>
  );
}
