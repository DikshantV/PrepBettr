"use client";

import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useTelemetry } from "@/components/providers/TelemetryProvider";
import RedirectGuard from "@/lib/utils/redirect-guard";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

import FormField from "./FormField";
import GoogleSignInButton from "./dynamic/GoogleSignInButtonDynamic";

const authFormSchema = (type: FormType) => {
    return z.object({
        name: type === "sign-up" ? z.string().min(3) : z.string().optional(),
        email: z.string().email(),
        password: z.string().min(3),
    });
};

const AuthForm = ({ type }: { type: FormType }) => {
    const router = useRouter();
    const [signInSuccess, setSignInSuccess] = useState(false);
    const { trackFormSubmission, trackUserAction, trackError } = useTelemetry();

    const formSchema = authFormSchema(type);
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
        },
    });

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        const startTime = Date.now();
        let success = false;

        try {
            if (type === "sign-up") {
                const { name, email, password } = data;

                // Call unified auth signup endpoint
                const response = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name, email, password }),
                });

                if (response.ok) {
                    success = true;
                    toast.success("Account created successfully. You can now sign in.");
                    
                    // Track successful sign up
                    await trackUserAction('signup', 'auth', {
                        method: 'email',
                        hasName: (!!name).toString()
                    });
                    
                    router.push("/sign-in");
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    const errorMessage = errorData.error || 'Failed to create account. Please try again.';
                    toast.error(errorMessage);
                    // Track failed sign up
                    await trackFormSubmission('signup_form', false, {
                        errorMessage,
                        duration: (Date.now() - startTime).toString()
                    });
                    return;
                }
            } else {
                const { email, password } = data;

                // Call unified auth signin endpoint
                const response = await fetch('/api/auth/signin', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password }),
                });

                if (response.ok) {
                    const result = await response.json();
                    // Store auth token if provided
                    if (result.token) {
                        localStorage.setItem('auth_token', result.token);
                    }
                    
                    console.log('AuthForm: Sign in successful, redirecting to dashboard');
                    success = true;
                    toast.success("Signed in successfully.");
                    
                    // Track successful sign in
                    await trackUserAction('signin', 'auth', {
                        method: 'email'
                    });
                    
                    setSignInSuccess(true);
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    const errorMessage = errorData.error || 'Failed to sign in. Please check your credentials and try again.';
                    toast.error(errorMessage);
                    
                    // Track failed sign in
                    await trackFormSubmission('signin_form', false, {
                        errorMessage,
                        duration: (Date.now() - startTime).toString()
                    });
                }
            }
        } catch (error) {
            console.log(error);
            const errorMessage = `There was an error: ${error}`;
            toast.error(errorMessage);
            
            // Track error
            await trackError(error instanceof Error ? error : new Error(errorMessage), {
                formType: type,
                action: type === 'sign-up' ? 'signup' : 'signin',
                duration: (Date.now() - startTime).toString()
            });
        } finally {
            // Track form submission if not already tracked
            if (success) {
                await trackFormSubmission(type === 'sign-up' ? 'signup_form' : 'signin_form', true, {
                    duration: (Date.now() - startTime).toString()
                });
            }
        }
    };

    // Handle redirect on successful sign-in
    useEffect(() => {
        if (signInSuccess) {
            console.log('AuthForm: Successful sign-in, preparing redirect to /dashboard');
            
            const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/sign-in';
            const targetPath = '/dashboard';
            
            // Check if redirect is allowed
            if (!RedirectGuard.canRedirect(targetPath)) {
                console.error('AuthForm: Redirect blocked by RedirectGuard - potential loop detected');
                toast.error('Authentication successful, but unable to redirect. Please navigate to dashboard manually.');
                return;
            }
            
            // Record the redirect attempt
            RedirectGuard.recordRedirect(currentPath, targetPath);
            
            // Add a small delay to ensure cookie propagation
            const redirectTimer = setTimeout(() => {
                console.log('AuthForm: Executing redirect to /dashboard');
                
                // Use window.location.href instead of router to ensure full page navigation
                // This prevents router-based issues and ensures fresh authentication state
                if (typeof window !== 'undefined') {
                    window.location.href = '/dashboard';
                }
            }, 500); // Increased delay for better cookie propagation
            
            // Cleanup timer if component unmounts
            return () => clearTimeout(redirectTimer);
        }
    }, [signInSuccess]);

    const isSignIn = type === "sign-in";

    return (
        <div className="flex flex-col gap-6 bg-gray-900/60 backdrop-blur-md rounded-2xl min-h-full py-14 px-10 border border-white/20 lg:min-w-[566px] w-full">
                <div className="flex flex-col items-center gap-4">
                    <div className="flex flex-row gap-2 justify-center">
                        <Image src="/logo.svg" alt="logo" height={32} width={38} />
                        <h2 className="text-white">PrepBettr</h2>
                    </div>
                </div>

                <h3 className="text-center text-white">Practice job interviews with AI</h3>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="w-full space-y-6 mt-4 form"
                    >
                        {!isSignIn && (
                            <FormField
                                control={form.control}
                                name="name"
                                label="Name"
                                placeholder="Your Name"
                                type="text"
                            />
                        )}

                        <FormField
                            control={form.control}
                            name="email"
                            label="Email"
                            placeholder="Your email address"
                            type="email"
                        />

                        <FormField
                            control={form.control}
                            name="password"
                            label="Password"
                            placeholder="Enter your password"
                            type="password"
                        />

                        <Button className="btn w-full" type="submit">
                            {isSignIn ? "Sign In" : "Create an Account"}
                        </Button>
                    </form>
                </Form>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-gray-900/80 px-2 text-white">
                            Or continue with
                        </span>
                    </div>
                </div>

                <GoogleSignInButton />

                <p className="text-center">
                    {isSignIn ? "No account yet?" : "Have an account already?"}
                    <Link
                        href={!isSignIn ? "/sign-in" : "/sign-up"}
                        className="font-bold text-user-primary ml-1"
                    >
                        {!isSignIn ? "Sign In" : "Sign Up"}
                    </Link>
                </p>
        </div>
    );
};

export default AuthForm;