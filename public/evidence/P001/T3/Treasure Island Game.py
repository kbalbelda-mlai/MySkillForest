print(r'''
*******************************************************************************
          |                   |                  |                     |
 _________|________________.=""_;=.______________|_____________________|_______
|                   |  ,-"_,=""     `"=.|                  |
|___________________|__"=._o`"-._        `"=.______________|___________________
          |                `"=._o`"=._      _`"=._                     |
 _________|_____________________:=._o "=._."_.-="'"=.__________________|_______
|                   |    __.--" , ; `"=._o." ,-"""-._ ".   |
|___________________|_._"  ,. .` ` `` ,  `"-._"-._   ". '__|___________________
          |           |o`"=._` , "` `; .". ,  "-._"-._; ;              |
 _________|___________| ;`-.o`"=._; ." ` '`."\ ` . "-._ /_______________|_______
|                   | |o ;    `"-.o`"=._``  '` " ,__.--o;   |
|___________________|_| ;     (#) `-.o `"=.`_.--"_o.-; ;___|___________________
____/______/______/___|o;._    "      `".o|o_.--"    ;o;____/______/______/____
/______/______/______/_"=._o--._        ; | ;        ; ;/______/______/______/_
____/______/______/______/__"=._o--._   ;o|o;     _._;o;____/______/______/____
/______/______/______/______/____"=._o._; | ;_.--"o.--"_/______/______/______/_
____/______/______/______/______/_____"=.o|o_.--""___/______/______/______/____
/______/______/______/______/______/______/______/______/______/______/_____ /
*******************************************************************************
''')
print("Welcome to Treasure Island.")
print("Your mission is to find the treasure.\n")

print("You are at a cross road. where do you want to go?")
direction = input("   type left or right: ")
if direction == "left":
    print("You have come to a lake. There is an island in the middle of the lake.")
    lake_action = input("   type ""wait"" to wait for a boat. Type ""swim"" to swim across: ")
    if lake_action == "wait":
        print("You come across three different doors. Which door do you choose?")
        door = input("   select a door from Red, Yellow, or Blue: ")
        if door == "Red":
            print("You are Burned by fire. Game over.")
        elif door == "Blue":
            print("You are eaten by Beasts. Game over.")
        elif door == "Yellow":
            print("Congratulations, you found the treasure.")
        else:
            print("You anger the gods by not choosing wisely. Game over.")
    elif lake_action == "swim":
        print("You are attacked by a trout. Game over.")
    else:
        print("You anger the gods by not choosing wisely. Game over.")
elif direction == "right":
    print("You fall into a hole. Game over.")
else:
    print("You anger the gods by not choosing wisely. Game over.")
