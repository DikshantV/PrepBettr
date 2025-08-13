"use client";

import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { auth } from "@/firebase/client";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useTelemetry } from "@/components/providers/TelemetryProvider";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
} from "firebase/auth";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

import { signIn, signUp } from "@/lib/actions/auth.action";
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

                const userCredential = await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

                const result = await signUp({
                    uid: userCredential.user.uid,
                    name: name!,
                    email,
                    password,
                });

                if (!result.success) {
                    toast.error(result.message);
                    // Track failed sign up
                    await trackFormSubmission('signup_form', false, {
                        errorMessage: result.message,
                        duration: (Date.now() - startTime).toString()
                    });
                    return;
                }

                success = true;
                toast.success("Account created successfully. You can now sign in.");
                
                // Track successful sign up
                await trackUserAction('signup', 'auth', {
                    method: 'email',
                    hasName: (!!name).toString()
                });
                
                router.push("/sign-in");
            } else {
                const { email, password } = data;

                const userCredential = await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

                const idToken = await userCredential.user.getIdToken();
                if (!idToken) {
                    toast.error("Sign in Failed. Please try again.");
                    // Track failed sign in
                    await trackFormSubmission('signin_form', false, {
                        errorMessage: 'No ID token received',
                        duration: (Date.now() - startTime).toString()
                    });
                    return;
                }

                // Call the API endpoint directly
                const response = await fetch('/api/auth/signin', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ idToken }),
                });

                if (response.ok) {
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
            console.log('AuthForm: Attempting router.replace to /dashboard');
            try {
                router.replace('/dashboard');
            } catch (error) {
                console.error('Router.replace failed:', error);
                console.log('AuthForm: Fallback to window.location.replace');
                if (typeof window !== 'undefined') {
                    window.location.replace('/dashboard');
                }
            }
        }
    }, [signInSuccess, router]);

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