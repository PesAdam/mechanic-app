<?php

namespace App\Services;

use App\Models\Car;
use App\Models\Customer;
use App\Models\WorkOrder;

/**
 * Whom an order is for. One customer row serves a car's whole history, so a new name typed on one order must
 * never travel to the others: a different name means a different person, and while the row is shared with
 * other orders that person gets a fresh row and only this order moves to it. The car follows only when this is
 * its latest order, so the next visit prefills the new person while the finished reports keep the one they
 * were made for. A new phone or email with the same name is the same person and is simply updated.
 */
final class Customers
{
    /**
     * @param  array{name?: string|null, phone?: string|null, email?: string|null}  $changes
     * @param  WorkOrder|null  $order  the order being edited; null while a new order is being made for the car
     */
    public static function revise(Customer $customer, array $changes, Car $car, ?WorkOrder $order = null): Customer
    {
        $changed = array_filter($changes, fn ($value, string $key) => $customer->getAttribute($key) !== $value, ARRAY_FILTER_USE_BOTH);
        if ($changed === []) {
            return $customer;
        }

        $shared = array_key_exists('name', $changed)
            && $customer->workOrders()->when($order, fn ($query) => $query->whereKeyNot($order->id))->exists();
        if (! $shared) {
            $customer->update($changed);

            return $customer;
        }

        $fresh = Customer::query()->create(array_merge($customer->only(['name', 'phone', 'email']), $changed));
        $latest = $order === null || $order->id === (int) $car->workOrders()->max('id');
        if ($car->customer_id === $customer->id && $latest) {
            $car->update(['customer_id' => $fresh->id]);
        }

        return $fresh;
    }
}
