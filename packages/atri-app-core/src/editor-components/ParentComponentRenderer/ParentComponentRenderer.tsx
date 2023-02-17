import { ParentComponentRendererProps } from "../../types";
import { componentStoreApi } from "../../api";
import { NormalComponentRenderer } from "../NormalComponentRenderer/NormalComponentRenderer";
import { useAssignParentMarker } from "../hooks/useAssignParentMaker";
import { useAssignComponentId } from "../hooks/useAssignComponentId";
import { useHandleNewChild } from "./hooks/useHandleNewChild";
import { useFocusComponent } from "../hooks/useFocusComponent";
import { useHasComponentRendered } from "../hooks/useHasComponentRendered";

export function ParentComponentRenderer(props: ParentComponentRendererProps) {
  const {
    comp: Comp,
    props: compProps,
    ref,
    callbacks,
  } = componentStoreApi.getComponent(props.id)!;
  const { children } = useHandleNewChild(props);
  useAssignParentMarker({ id: props.id });
  useAssignComponentId({ id: props.id });
  useFocusComponent({ id: props.id });
  useHasComponentRendered({ id: props.id });
  return (
    <Comp {...compProps} ref={ref} {...callbacks}>
      {children.map((childId) => {
        const { acceptsChild } = componentStoreApi.getComponent(childId)!;
        return acceptsChild ? (
          <ParentComponentRenderer id={childId} key={childId} />
        ) : (
          <NormalComponentRenderer id={childId} key={childId} />
        );
      })}
    </Comp>
  );
}