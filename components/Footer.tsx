export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span>Studio EJB. {year}.</span>
        <span>
          Made with care. <a href="/contact">Get in touch.</a>
        </span>
      </div>
    </footer>
  );
}
