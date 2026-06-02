import { useState } from "react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, MapPin, Phone } from "lucide-react";

const contactItems = [
  { icon: Mail, title: "Email", desc: "shahrukh.bsse4377@iiu.edu.pk" },
  { icon: Phone, title: "Phone", desc: "+92 308-8540903" },
  { icon: MapPin, title: "Location", desc: "Islamabad, Pakistan" },
  { icon: MapPin, title: "Address", desc: "International Islamic University Islamabad" },
];

const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("contacts").insert([form]);
    setLoading(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Message sent!", description: "We'll get back to you soon." });
    setForm({ name: "", email: "", message: "" });
  };

  return (
    <div className="premium-page min-h-screen overflow-hidden">
      <Navbar showNavigation={false} />

      <main className="container relative mx-auto flex min-h-[calc(100svh-5.5rem)] flex-col justify-center px-4 py-5 md:px-6">
        <div className="premium-grid absolute inset-0 opacity-35" />
        <section className="relative mb-6 max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-primary">Contact</p>
          <h1 className="text-5xl font-extrabold leading-tight md:text-6xl">Get support or share feedback.</h1>
        </section>

        <section className="relative grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {contactItems.map((item) => (
              <div key={item.title} className="premium-card flex items-center gap-3 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="text-sm text-muted-foreground">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={onSubmit} className="premium-card space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                rows={4}
                required
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={loading} className="premium-button w-full">
              {loading ? "Sending..." : "Send Message"}
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
};

export default Contact;
