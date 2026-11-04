import { useFrontmatter } from "@void/md";
export default function Layout({ children }) {
  return <div><p id="fm">{useFrontmatter().title}</p>{children}</div>;
}