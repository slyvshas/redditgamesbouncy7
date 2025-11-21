import { Scene } from 'phaser';
import * as Phaser from 'phaser';


export class Game extends Scene {

  background!: Phaser.GameObjects.Image;
  chef!: Phaser.Physics.Arcade.Sprite;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  ingredients!: Phaser.Physics.Arcade.Group;
  hazards!: Phaser.Physics.Arcade.Group;
  powerups!: Phaser.Physics.Arcade.Group;
  score: number = 0;
  scoreText!: Phaser.GameObjects.Text;
  shield: number = 0;
  magnetActive: boolean = false;
  combo: number = 0;
  speed: number = 200;
  spawnTimer: number = 0;
  difficultyTimer: number = 0;

  constructor() {
    super('Game');
  }

  create() {
    // Background
    this.background = this.add.image(512, 384, 'background').setAlpha(0.25);

    // Enable Arcade Physics
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);

    // Chef
    this.chef = this.physics.add.sprite(this.scale.width / 2, this.scale.height - 100, 'chef');
    this.chef.setBounce(0.5);
    this.chef.setCollideWorldBounds(true);
    this.chef.setGravityY(600);
    this.chef.setVelocityX(this.speed);

    // Groups
    this.ingredients = this.physics.add.group();
    this.hazards = this.physics.add.group();
    this.powerups = this.physics.add.group();

    // Score UI
    this.scoreText = this.add.text(32, 32, 'Score: 0', {
      fontFamily: 'Arial Black',
      fontSize: 36,
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 6,
    });

    // Tap to jump/change direction
    this.input.on('pointerdown', () => {
      if (this.chef.body.touching.down) {
        this.chef.setVelocityY(-400);
      } else {
        this.chef.setVelocityX(-this.chef.body.velocity.x);
      }
    });

    // Collisions
    this.physics.add.overlap(this.chef, this.ingredients, this.collectIngredient, undefined, this);
    this.physics.add.overlap(this.chef, this.hazards, this.hitHazard, undefined, this);
    this.physics.add.overlap(this.chef, this.powerups, this.collectPowerup, undefined, this);
  }


  update(time: number, delta: number) {
    // Spawn ingredients, hazards, and powerups
    this.spawnTimer += delta;
    this.difficultyTimer += delta;
    if (this.spawnTimer > 800) {
      this.spawnRandomObject();
      this.spawnTimer = 0;
    }
    // Increase speed/difficulty
    if (this.difficultyTimer > 5000) {
      this.speed += 20;
      this.chef.setVelocityX(this.chef.body.velocity.x > 0 ? this.speed : -this.speed);
      this.difficultyTimer = 0;
    }
    // Magnet effect
    if (this.magnetActive) {
      this.ingredients.children.iterate((obj: Phaser.GameObjects.GameObject | null) => {
        const ingredient = obj as Phaser.Physics.Arcade.Sprite;
        if (ingredient && Phaser.Math.Distance.BetweenPoints(ingredient, this.chef) < 200) {
          this.physics.moveToObject(ingredient, this.chef, 300);
        }
      });
    }
  }

  spawnRandomObject() {
    const x = Phaser.Math.Between(50, this.scale.width - 50);
    const type = Phaser.Math.Between(1, 10);
    if (type <= 6) {
      // Ingredient
      const ingredient = this.ingredients.create(x, -30, 'ingredient');
      ingredient.setVelocityY(Phaser.Math.Between(200, 350));
      ingredient.setBounce(0.5);
    } else if (type <= 9) {
      // Hazard
      const hazard = this.hazards.create(x, -30, 'hazard');
      hazard.setVelocityY(Phaser.Math.Between(250, 400));
      hazard.setBounce(0.5);
    } else {
      // Powerup
      const powerType = Phaser.Math.Between(0, 1) === 0 ? 'shield' : 'magnet';
      const powerup = this.powerups.create(x, -30, powerType);
      powerup.setVelocityY(Phaser.Math.Between(200, 350));
      powerup.setBounce(0.5);
      powerup.setData('type', powerType);
    }
  }

  collectIngredient(
    chef: Phaser.GameObjects.GameObject,
    ingredient: Phaser.GameObjects.GameObject
  ): void {
    ingredient.destroy();
    this.score += 1;
    this.combo += 1;
    this.scoreText.setText('Score: ' + this.score);
    // Combo bonus (optional):
    // if (this.combo % 5 === 0) this.score += 5;
  }

  hitHazard(
    chef: Phaser.GameObjects.GameObject,
    hazard: Phaser.GameObjects.GameObject
  ): void {
    hazard.destroy();
    if (this.shield > 0) {
      this.shield--;
      // Optionally show shield effect
    } else {
      this.scene.start('GameOver', { score: this.score });
    }
  }

  collectPowerup(
    chef: Phaser.GameObjects.GameObject,
    powerup: Phaser.GameObjects.GameObject
  ): void {
    const type = powerup.getData('type');
    powerup.destroy();
    if (type === 'shield') {
      this.shield = 3;
      // Optionally show shield UI
    } else if (type === 'magnet') {
      this.magnetActive = true;
      this.time.delayedCall(5000, () => (this.magnetActive = false));
    }
  }
}
