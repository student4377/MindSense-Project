import { Brain, Mail, MapPin, Phone } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer id="contact" className="border-t border-white/10 bg-background text-muted-foreground">
      <div className="container mx-auto px-4 py-14 md:px-6">
        <div className="glass-panel rounded-3xl p-6 md:p-8">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.25fr_0.65fr_0.7fr_0.8fr_1fr]">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-sky-400 to-violet-400 text-primary-foreground shadow-[var(--shadow-soft)]">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-foreground">MindSense</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">AI Wellness Platform</div>
                </div>
              </div>
              <p className="mt-5 max-w-sm text-sm leading-6">
                A multimodal mental wellness system for assessment, mood tracking, AI assistance, reports, and guided support.
              </p>
            </div>

            <div>
              <h4 className="mb-4 font-semibold text-foreground">Product</h4>
              <ul className="space-y-3 text-sm">
                <li><Link to="/" className="hover:text-primary">Home</Link></li>
                <li><Link to="/about" className="hover:text-primary">About</Link></li>
                <li><Link to="/features" className="hover:text-primary">Features</Link></li>
                <li><Link to="/contact" className="hover:text-primary">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold text-foreground">Workspace</h4>
              <ul className="space-y-3 text-sm">
                <li><Link to="/dashboard" className="hover:text-primary">Dashboard</Link></li>
                <li><Link to="/test" className="hover:text-primary">Assessment</Link></li>
                <li><Link to="/mood" className="hover:text-primary">Mood Tracking</Link></li>
                <li><Link to="/resources" className="hover:text-primary">Resources</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold text-foreground">Trust</h4>
              <ul className="space-y-3 text-sm">
                <li><Link to="/about" className="hover:text-primary">Privacy & Safety</Link></li>
                <li><Link to="/contact" className="hover:text-primary">Support</Link></li>
                <li><Link to="/features" className="hover:text-primary">Responsible Use</Link></li>
                <li><Link to="/contact" className="hover:text-primary">Emergency Help</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold text-foreground">Contact</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-3"><Mail className="h-4 w-4 text-primary" /> shahrukh.bsse4377@iiu.edu.pk</li>
                <li className="flex items-center gap-3"><Phone className="h-4 w-4 text-primary" /> +92 308-8540903</li>
                <li className="flex items-start gap-3"><MapPin className="mt-0.5 h-4 w-4 text-primary" /> Islamabad, Pakistan</li>
                <li className="flex items-start gap-3"><MapPin className="mt-0.5 h-4 w-4 text-primary" /> International Islamic University Islamabad</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-5 text-center text-xs">
            © {new Date().getFullYear()} MindSense Mental Health System. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
