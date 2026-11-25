import { Link } from "@/navigation";
import Photo from "../ui/Photo";
import { stagger } from "../motion/delay";

export type Post = { href: string; image: string; meta: string; title: string; body: string };

/** Framer blog cards: a 20px-corner photo, a grey meta line, a 26px title and a two-line summary. */
export default function PostCards({ posts }: { posts: Post[] }) {
  return (
    <ul className="ds-posts">
      {posts.map((p, i) => (
        <li key={p.href} data-reveal="" style={stagger(i)}>
          <Link href={p.href} className="ds-post">
            <Photo src={p.image} sizes="(max-width: 809px) 100vw, (max-width: 1199px) 50vw, 421px" className="ds-post-photo" />
            <div className="ds-post-text">
              <p className="ds-post-meta">{p.meta}</p>
              <h3 className="ds-title">{p.title}</h3>
              <p className="ds-body ds-clamp-2">{p.body}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
