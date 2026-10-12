<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return UserResource::collection(User::query()->orderByDesc('is_active')->orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', User::class);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:120', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'max:200'],
            'role' => ['nullable', Rule::enum(Role::class)],
        ]);

        $user = User::query()->create([
            ...$data,
            'role' => $data['role'] ?? Role::Mechanic->value,
            'is_active' => true,
        ]);

        return (new UserResource($user))->response()->setStatusCode(201);
    }

    public function update(Request $request, User $user): UserResource
    {
        Gate::authorize('update', $user);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'email', 'max:120', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'nullable', 'string', 'min:8', 'max:200'],
            'role' => ['sometimes', Rule::enum(Role::class)],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $isSelf = $user->is($request->user());
        if ($isSelf && array_key_exists('is_active', $data) && ! $data['is_active']) {
            throw ValidationException::withMessages(['is_active' => ['Vlastný účet nemôžete deaktivovať.']]);
        }
        if ($isSelf && isset($data['role']) && $data['role'] !== Role::Owner->value) {
            throw ValidationException::withMessages(['role' => ['Vlastnú rolu majiteľa nemôžete odobrať.']]);
        }
        if (array_key_exists('password', $data) && $data['password'] === null) {
            unset($data['password']);
        }

        $user->update($data);

        // A deactivated colleague is signed out everywhere at once.
        if (! $user->is_active) {
            $user->tokens()->delete();
        }

        return new UserResource($user->fresh());
    }
}
