import { motion } from 'framer-motion';

interface LogosSectionProps {
  content: {
    title: string;
    items: { title: string; image_url: string }[];
  };
}

export default function LogosSection({ content }: LogosSectionProps) {
  return (
    <section className="py-12">
      <div className="container mx-auto text-center">
        <motion.p 
          className="text-muted-foreground mb-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {content.title}
        </motion.p>
        <motion.div 
          className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {content.items.map((logo) => (
            <img 
              key={logo.title}
              src={logo.image_url} 
              alt={logo.title}
              className="h-8 object-contain"
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
