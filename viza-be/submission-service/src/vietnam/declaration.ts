export function uncheckedVietnamDeclarationIndexes(checkedStates: boolean[]): number[] {
  return checkedStates.flatMap((checked, index) => (checked ? [] : [index]));
}
