import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { 
  MessageSquare, 
  ShoppingCart, 
  Bell, 
  Table, 
  ArrowRight, 
  Check,
  Shirt,
  UtensilsCrossed,
  Calendar,
  Sparkles,
  Zap,
  Shield,
  Phone,
  Camera,
  Facebook,
  Music
} from 'lucide-react';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } }
};

export default function Landing() {
  const { t, dir } = useLanguage();

  const features = [
    { 
      icon: MessageSquare, 
      title: t('features.ai.title'), 
      desc: t('features.ai.desc'),
      color: 'text-primary'
    },
    { 
      icon: ShoppingCart, 
      title: t('features.orders.title'), 
      desc: t('features.orders.desc'),
      color: 'text-accent'
    },
    { 
      icon: Table, 
      title: t('features.sheets.title'), 
      desc: t('features.sheets.desc'),
      color: 'text-info'
    },
    { 
      icon: Bell, 
      title: t('features.notify.title'), 
      desc: t('features.notify.desc'),
      color: 'text-warning'
    },
  ];

  const channels = [
    { name: t('channels.whatsapp'), icon: Phone, color: 'bg-whatsapp' },
    { name: t('channels.instagram'), icon: Camera, color: 'bg-instagram' },
    { name: t('channels.facebook'), icon: Facebook, color: 'bg-facebook' },
    { name: t('channels.tiktok'), icon: Music, color: 'bg-tiktok' },
    { name: t('channels.webchat'), icon: MessageSquare, color: 'bg-webchat' },
  ];

  const steps = [
    { num: '1', title: t('how.step1.title'), desc: t('how.step1.desc'), icon: Zap },
    { num: '2', title: t('how.step2.title'), desc: t('how.step2.desc'), icon: Sparkles },
    { num: '3', title: t('how.step3.title'), desc: t('how.step3.desc'), icon: Shield },
  ];

  const useCases = [
    { title: t('usecases.clothing'), icon: Shirt },
    { title: t('usecases.food'), icon: UtensilsCrossed },
    { title: t('usecases.services'), icon: Calendar },
  ];

  const pricing = [
    { 
      name: t('pricing.free'), 
      price: '0', 
      features: ['100 messages/month', '1 channel', 'Basic AI replies'] 
    },
    { 
      name: t('pricing.pro'), 
      price: '49', 
      popular: true,
      features: ['5,000 messages/month', 'All channels', 'Advanced AI', 'Google Sheets', 'Priority support'] 
    },
    { 
      name: t('pricing.business'), 
      price: '149', 
      features: ['Unlimited messages', 'All channels', 'Custom AI training', 'API access', 'Dedicated support'] 
    },
  ];

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold gradient-text">
            Tamm
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              {t('nav.features')}
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              {t('nav.pricing')}
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              {t('nav.docs')}
            </a>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link to="/login">
              <Button variant="ghost">{t('nav.login')}</Button>
            </Link>
            <Link to="/login">
              <Button variant="hero">{t('nav.start')}</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div 
            className="text-center"
            initial="initial"
            animate="animate"
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp} className="mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent rounded-full text-sm font-medium">
                <Sparkles className="h-4 w-4" />
                {dir === 'rtl' ? 'الذكاء الاصطناعي للتجارة الاجتماعية' : 'AI-Powered Social Commerce'}
              </span>
            </motion.div>
            
            <motion.h1 
              variants={fadeInUp}
              className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight"
            >
              {t('hero.title')}
            </motion.h1>
            
            <motion.p 
              variants={fadeInUp}
              className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
            >
              {t('hero.subtitle')}
            </motion.p>
            
            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/login">
                <Button variant="hero" size="xl" className="w-full sm:w-auto">
                  {t('hero.cta')}
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Button variant="outline" size="xl" className="w-full sm:w-auto">
                {t('hero.secondary')}
              </Button>
            </motion.div>

            {/* Channel Icons */}
            <motion.div 
              variants={fadeInUp}
              className="mt-16 flex flex-wrap justify-center gap-4"
            >
              {channels.map((channel) => (
                <div 
                  key={channel.name}
                  className="flex items-center gap-2 px-4 py-2 bg-card rounded-full border border-border shadow-sm"
                >
                  <div className={`w-8 h-8 ${channel.color} rounded-full flex items-center justify-center`}>
                    <channel.icon className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="text-sm font-medium">{channel.name}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('features.title')}
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold">
              {t('how.title')}
            </h2>
          </motion.div>

          <div className="space-y-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, x: dir === 'rtl' ? 20 : -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="flex gap-6 items-start"
              >
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
                  {step.num}
                </div>
                <div className="flex-1 pt-2">
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold">
              {t('usecases.title')}
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {useCases.map((useCase, i) => (
              <motion.div
                key={useCase.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card rounded-2xl p-8 text-center border border-border"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <useCase.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{useCase.title}</h3>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold">
              {t('pricing.title')}
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {pricing.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative bg-card rounded-2xl p-8 border ${
                  plan.popular ? 'border-primary shadow-lg shadow-primary/10' : 'border-border'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                      {t('pricing.popular')}
                    </span>
                  </div>
                )}
                <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">{t('pricing.month')}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-accent flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button 
                  variant={plan.popular ? 'hero' : 'outline'} 
                  className="w-full"
                >
                  {t('hero.cta')}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-2xl font-bold gradient-text">Tamm</div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">{t('footer.docs')}</a>
              <a href="#" className="hover:text-foreground transition-colors">{t('footer.privacy')}</a>
              <a href="#" className="hover:text-foreground transition-colors">{t('footer.terms')}</a>
            </div>
            <div className="text-sm text-muted-foreground">
              {t('footer.copyright')}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
