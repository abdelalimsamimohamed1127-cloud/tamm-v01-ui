import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

interface HeroSectionProps {
  content: {
    headline: string;
    sub_headline: string;
    primary_cta: { label: string; href: string };
    secondary_cta: { label: string; href: string };
  };
}

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } }
};

export default function HeroSection({ content }: HeroSectionProps) {
  return (
    <section className="py-20 text-center">
      <motion.div 
        className="container mx-auto max-w-6xl"
        initial="initial"
        animate="animate"
        variants={staggerContainer}
      >
        <motion.div variants={fadeInUp} className="mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            AI-Powered Social Commerce
          </span>
        </motion.div>
        
        <motion.h1 
          variants={fadeInUp}
          className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
        >
          {content.headline}
        </motion.h1>
        
        <motion.p 
          variants={fadeInUp}
          className="text-lg text-muted-foreground max-w-3xl mx-auto mb-10"
        >
          {content.sub_headline}
        </motion.p>
        
        <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to={content.primary_cta.href}>
            <Button size="xl" className="w-full sm:w-auto">
              {content.primary_cta.label}
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
          <Link to={content.secondary_cta.href}>
            <Button variant="outline" size="xl" className="w-full sm:w-auto">
              {content.secondary_cta.label}
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
