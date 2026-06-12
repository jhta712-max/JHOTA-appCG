import { X } from 'lucide-react';

/**
 * Modal estándar del design system industrial:
 * overlay oscuro, panel blanco sin radius, header #1C1C1C con título
 * uppercase y botón X (gris → amarillo on hover).
 *
 * El contenido (children) define su propio padding — normalmente `p-6`.
 */
export default function FormModal({
  title,
  onClose,
  children,
  maxWidth = 'max-w-lg',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
      <div className={`bg-white w-full ${maxWidth} max-h-[90vh] overflow-y-auto shadow-2xl`}>
        <div className="bg-[#1C1C1C] flex items-center justify-between px-6 py-4">
          <h2 className="font-black text-white font-['Barlow_Condensed'] text-xl uppercase tracking-wide">
            {title}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-[#F5C218] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
