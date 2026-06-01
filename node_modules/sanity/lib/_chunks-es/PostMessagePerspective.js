import { c } from "react/compiler-runtime";
import { memo, useEffect, startTransition } from "react";
const PostMessagePerspective = (props) => {
  const $ = c(9), {
    comlink,
    perspective,
    setHandlesPerspectiveChange
  } = props;
  let t0, t1;
  $[0] !== comlink || $[1] !== perspective || $[2] !== setHandlesPerspectiveChange ? (t0 = () => comlink.on("visual-editing/fetch-perspective", (payload) => (startTransition(() => setHandlesPerspectiveChange(payload?.handlesPerspectiveChange === !0)), {
    perspective
  })), t1 = [comlink, perspective, setHandlesPerspectiveChange], $[0] = comlink, $[1] = perspective, $[2] = setHandlesPerspectiveChange, $[3] = t0, $[4] = t1) : (t0 = $[3], t1 = $[4]), useEffect(t0, t1);
  let t2, t3;
  return $[5] !== comlink || $[6] !== perspective ? (t2 = () => {
    comlink.post("presentation/perspective", {
      perspective
    });
  }, t3 = [comlink, perspective], $[5] = comlink, $[6] = perspective, $[7] = t2, $[8] = t3) : (t2 = $[7], t3 = $[8]), useEffect(t2, t3), null;
};
var PostMessagePerspective_default = memo(PostMessagePerspective);
export {
  PostMessagePerspective_default as default
};
//# sourceMappingURL=PostMessagePerspective.js.map
