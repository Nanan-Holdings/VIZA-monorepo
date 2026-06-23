export function buildExistingAuthUserUpdate({
  existingUserMetadata,
  name,
  role,
  password,
  shouldUpdatePassword,
}) {
  const update = {
    user_metadata: {
      ...(existingUserMetadata ?? {}),
      name,
      role,
    },
  };

  if (shouldUpdatePassword) {
    update.password = password;
  }

  return update;
}
