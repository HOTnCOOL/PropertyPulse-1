import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function DepositPolicyPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="container max-w-3xl py-8">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => window.history.back()}
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <div className="prose prose-slate dark:prose-invert max-w-none">
        <h1>Deposit Policy</h1>

        <h2>Overview</h2>
        <p>
          We aim to make your booking process as straightforward as possible. Below are the details of our
          deposit policy, designed to clarify the requirements for various booking scenarios.
        </p>

        <h3>Security Deposit Requirements</h3>
        <h4>General Rules</h4>
        <ul>
          <li>No security deposit is charged for fully prepaid bookings</li>
          <li>For all stays longer than 3 days that are only partially paid, a security deposit must be paid in advance or guaranteed by credit card</li>
          <li>The deposit is fully refundable at checkout</li>
          <li>If at least two packs of the same type are prepaid, the deposit can be reduced by half</li>
        </ul>

        <h4>Deposit Amount</h4>
        <p>The amount of the deposit is determined according to the duration of your stay:</p>
        <ol>
          <li>$90 for stays longer than 3 days and shorter than 2 weeks (one daily rate deposit)</li>
          <li>$420 for stays longer than 2 weeks and shorter than 2 months (one weekly rate deposit)</li>
          <li>$1200 for stays longer than 2 months (one monthly rate deposit)</li>
        </ol>

        <h3>Summary of Payment Options</h3>
        <p>
          To help you better understand your payment options, we present several scenarios illustrating
          how your bookings may be structured based on preferred payment plans:
        </p>

        <h4>Monthly Payment</h4>
        <ul>
          <li>Two monthly packs and two weekly packs with regular prices apply for a booking duration of 2.5 months</li>
          <li>The total will be calculated without any upfront prepayment discounts</li>
          <li>Initial Payment Required: First monthly pack + deposit</li>
        </ul>

        <h4>Weekly Payment</h4>
        <ul>
          <li>Paying in weekly installments allows flexibility; however, the total amount at the end of your stay tends to be higher than the first monthly scenario</li>
          <li>Initial Payment Required: First weekly pack + deposit</li>
        </ul>

        <h4>Daily Payment</h4>
        <ul>
          <li>Users can opt to pay on a daily basis, offering maximum flexibility in payment scheduling</li>
          <li>Initial Payment Required: First daily pack + deposit</li>
        </ul>

        <h3>Need Assistance?</h3>
        <p>
          If you have questions regarding the deposit or payment policy, our support team is available
          to assist you with more details. Please reach out for clarification!
        </p>
      </div>
    </div>
  );
}