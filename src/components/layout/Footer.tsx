export default function Footer() {
  return (
    <footer className="border-t">
      <div className="container flex h-14 items-center justify-between text-sm text-muted-foreground px-4 bg-card/60">
        <a href="https://codervent.com/" rel="noopener noreferrer" className="hover:underline">
         <span>
            © {new Date().getFullYear()}{" "}
            <span className="font-medium text-foreground">Codervent</span>. All
            rights reserved.
          </span>
        </a>
        <span>
          Built with ❤️ by{" "}
          <span className="font-medium text-foreground"><a href="https://codervent.com/" rel="noopener noreferrer" className="hover:underline">Codervent</a></span>
        </span>
      </div>
    </footer>
  )
}
