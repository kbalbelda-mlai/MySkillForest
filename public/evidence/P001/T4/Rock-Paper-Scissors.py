rock = '''
    _______
---'   ____)
      (_____)
      (_____)
      (____)
---.__(___)
'''

paper = '''
    _______
---'   ____)____
          ______)
          _______)
         _______)
---.__________)
'''

scissors = '''
    _______
---'   ____)____
          ______)
       __________)
      (____)
---.__(___)
'''

your_input = int(input("What do you choose? Type 0 for Rock, 1 for Paper, 2 for Scissors: "))

if your_input == 0:
    your_weapon = rock
elif your_input == 1:
    your_weapon = paper
elif your_input == 2:
    your_weapon = scissors
else:
    your_weapon = "Forfeit"

import random

computer_number = random.randint(0,2)

computer_weapon = ""

if computer_number == 0:
    computer_weapon = rock
elif computer_number== 1:
    computer_weapon = paper
elif computer_number == 2:
    computer_weapon = scissors

print(your_weapon)
print("Computer chose:")
print(computer_weapon)

if your_weapon == "Forfeit":
    print("You lose")
if your_weapon == rock:
    if computer_weapon == rock:
        print("It's a draw")
    elif computer_weapon == paper:
        print("You lose")
    elif computer_weapon == scissors:
        print("You win")
elif your_weapon == paper:
    if computer_weapon == rock:
        print("You win")
    elif computer_weapon == paper:
        print("It's a draw")
    elif computer_weapon == scissors:
        print("You lose")
elif your_weapon == scissors:
    if computer_weapon == rock:
        print("You lose")
    elif computer_weapon == paper:
        print("You win")
    elif computer_weapon == scissors:
        print("It's a draw")
