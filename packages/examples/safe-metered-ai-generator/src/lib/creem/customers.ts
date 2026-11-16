import type { CustomerEntity } from 'creem/models/components'
import { CreemError } from 'creem/models/errors'
import { creemClient } from './client'

/** Thrown when the Creem customer for this email already belongs to another app user. */
export class CustomerOwnedByAnotherUserError extends Error {
  constructor() {
    super('customer_owned_by_another_user')
    this.name = 'CustomerOwnedByAnotherUserError'
  }
}

/** What to do with the Creem customer found for a user's email. */
export function customerOwnership(found: Pick<CustomerEntity, 'externalId'>, userId: string): 'own' | 'claim' | 'refuse' {
  if (found.externalId === userId) return 'own'
  return found.externalId ? 'refuse' : 'claim'
}

/**
 * Find the Creem customer for an app user, or create one.
 *
 * Creem keeps one customer per email and store, so the email is what ties a
 * user to a customer and to its wallet. Only call this for a user whose email
 * is verified: otherwise anyone could sign up with another customer's email and
 * get their wallet.
 *
 * `externalId` is the app's own user id. A customer that already carries a
 * different one belongs to another app user and is refused. A customer without
 * one (it bought through a checkout link, say) is claimed for this user.
 */
export async function findOrCreateCustomer(user: { id: string; email: string; name: string }): Promise<CustomerEntity> {
  const found = await creemClient.customers.retrieve(undefined, user.email).catch((err: unknown) => {
    if (err instanceof CreemError && err.statusCode === 404) return null
    throw err
  })
  if (!found) return creemClient.customers.create({ email: user.email, name: user.name || user.email, externalId: user.id })
  const ownership = customerOwnership(found, user.id)
  if (ownership === 'refuse') throw new CustomerOwnedByAnotherUserError()
  if (ownership === 'claim') return creemClient.customers.update({ customerId: found.id, externalId: user.id })
  return found
}
