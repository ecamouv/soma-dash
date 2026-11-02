import { hexToRgba } from "@/lib/clientColors";
import { initialsOf } from "@/lib/opsHome";

/** Círculo con las iniciales del cliente, en el color que se le asignó en Clientes. */
export default function ClientAvatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
      style={{ width: size, height: size, backgroundColor: hexToRgba(color, 0.22), color }}
    >
      {initialsOf(name)}
    </span>
  );
}
