import Phaser from 'phaser';

class GameScene extends Phaser.Scene {
  // --- Class Properties ---
  private chef!: Phaser.Physics.Arcade.Sprite;
  private ingredients!: Phaser.Physics.Arcade.Group;
  private hazards!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private score: number = 0;
  private highScore: number = 0;
  private combo: number = 0;
  private difficulty: number = 1;
  
  private scoreText!: Phaser.GameObjects.Text;
  private highScoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private startText!: Phaser.GameObjects.Text;

  private collectParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private explosionParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  
  private lastComboTime: number = 0;
  private isGameActive: boolean = false;
  private isGameOver: boolean = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    // 1. Create Background
    const bg = this.textures.createCanvas('bg', 400, 600);
    if (bg) {
      const ctx = bg.getContext();
      const gradient = ctx.createLinearGradient(0, 0, 0, 600);
      gradient.addColorStop(0, '#4facfe');
      gradient.addColorStop(1, '#00f2fe');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 400, 600);
      bg.refresh();
    }

    // 2. Create Particle Texture
    const particle = this.textures.createCanvas('particle', 8, 8);
    if (particle) {
      const pCtx = particle.getContext();
      pCtx.fillStyle = '#fff';
      pCtx.beginPath();
      pCtx.arc(4, 4, 4, 0, Math.PI * 2);
      pCtx.fill();
      particle.refresh();
    }

    // 3. Load Images
    this.load.image('chef', '/assets/chef.png');
    this.load.image('ingredient', '/assets/ingredient.png');
    this.load.image('hazard', '/assets/hazard.png');
  }

  create(): void {
    // Safe High Score Loading
    const storedScore = localStorage.getItem('chefHighScore');
    this.highScore = storedScore ? parseInt(storedScore, 10) : 0;
    if (isNaN(this.highScore)) this.highScore = 0;

    // Background
    this.add.image(200, 300, 'bg');

    // Input
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
    }

    // --- PARTICLES ---
    this.collectParticles = this.add.particles(0, 0, 'particle', {
      speed: { min: 50, max: 150 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 500,
      blendMode: 'ADD',
      tint: 0x4ade80, // Green
      emitting: false
    });

    this.explosionParticles = this.add.particles(0, 0, 'particle', {
      speed: { min: 100, max: 300 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 800,
      blendMode: 'ADD',
      tint: 0xff0000, // Red
      emitting: false
    });

    // Physics World
    this.physics.world.setBounds(0, 0, 400, 600);

    // --- CHEF SETUP ---
    this.chef = this.physics.add.sprite(200, 500, 'chef');
    this.chef.setCollideWorldBounds(true);
    this.chef.setGravityY(1200);
    this.chef.setDisplaySize(50, 50);
    this.chef.setSize(30, 30); // Hitbox smaller than visual
    this.chef.setOffset(10, 10); // Center the hitbox
    this.chef.setDragX(1500); 

    // Groups
    this.ingredients = this.physics.add.group();
    this.hazards = this.physics.add.group();

    // --- UI SETUP ---
    const textStyle = {
      fontFamily: 'Arial', fontSize: '24px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 4
    };

    this.scoreText = this.add.text(20, 20, 'Score: 0', textStyle);
    this.highScoreText = this.add.text(20, 50, `Best: ${this.highScore}`, { ...textStyle, color: '#ffd700', fontSize: '18px' });
    
    this.comboText = this.add.text(200, 100, '', {
      fontFamily: 'Arial Black', fontSize: '40px', color: '#ff00de',
      stroke: '#fff', strokeThickness: 6
    }).setOrigin(0.5).setAlpha(0);

    this.startText = this.add.text(200, 300, 'TAP TO START', {
      fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5);

    // --- CONTROLS ---
    this.input.on('pointerdown', () => {
      if (!this.isGameActive) {
        this.startGame();
        return;
      }
      
      const body = this.chef.body as Phaser.Physics.Arcade.Body;
      if (body && body.onFloor()) {
        this.chef.setVelocityY(-600);
        this.tweens.add({
            targets: this.chef,
            scaleX: this.chef.scaleX * 1.3, 
            scaleY: this.chef.scaleY * 0.8,
            duration: 100,
            yoyo: true
        });
      }
    });

    // --- COLLISIONS ---
    // Important: The 3rd argument is the function that runs when they touch
    this.physics.add.overlap(
        this.chef, 
        this.ingredients, 
        this.handleCollectIngredient, // <--- This function runs on collection
        undefined, 
        this
    );

    this.physics.add.overlap(
        this.chef, 
        this.hazards, 
        this.handleHitHazard, 
        undefined, 
        this
    );
  }

  private startGame(): void {
    this.isGameActive = true;
    this.isGameOver = false;
    this.startText.setVisible(false);
    
    this.score = 0;
    this.combo = 0;
    this.difficulty = 1;
    this.scoreText.setText('Score: 0');
    
    this.chef.setTint(0xffffff);
    this.chef.x = 200;
    this.chef.y = 500;
    this.chef.setVelocity(0, 0);
    this.physics.resume();

    // Spawners
    this.time.addEvent({ delay: 800, callback: this.spawnIngredient, callbackScope: this, loop: true });
    this.time.addEvent({ delay: 1500, callback: this.spawnHazard, callbackScope: this, loop: true });

    this.time.addEvent({
        delay: 5000,
        callback: () => { if(this.isGameActive) this.difficulty += 0.1; },
        loop: true
    });
  }

  override update(time: number, _delta: number): void {
    if (!this.isGameActive || this.isGameOver) return;

    const speed = 300;
    const pointer = this.input.activePointer;

    // Movement
    if (this.cursors.left.isDown) {
      this.chef.setVelocityX(-speed);
      this.chef.setFlipX(true);
    } else if (this.cursors.right.isDown) {
      this.chef.setVelocityX(speed);
      this.chef.setFlipX(false);
    } else if (pointer.isDown) {
      if (pointer.x < this.chef.x - 10) {
        this.chef.setVelocityX(-speed);
        this.chef.setFlipX(true);
      } else if (pointer.x > this.chef.x + 10) {
        this.chef.setVelocityX(speed);
        this.chef.setFlipX(false);
      }
    }

    // Combo Timer
    if (this.combo > 0 && time - this.lastComboTime > 2000) {
      this.combo = 0;
      this.comboText.setAlpha(0);
    }

    // Cleanup
    this.ingredients.children.each((child: any) => {
      if (child.active && child.y > 650) child.destroy();
      return true;
    });
    this.hazards.children.each((child: any) => {
      if (child.active && child.y > 650) child.destroy();
      return true;
    });
  }

  // --- SPAWNERS ---
  private spawnIngredient(): void {
    if (!this.isGameActive) return;

    const x = Phaser.Math.Between(50, 350);
    const item = this.ingredients.create(x, -50, 'ingredient') as Phaser.Physics.Arcade.Image;
    
    item.setDisplaySize(35, 35);
    item.setSize(40, 40); // Bigger hitbox = Easier to catch
    item.setVelocityY(150 + (this.difficulty * 20));

    this.tweens.add({
      targets: item,
      x: x + Phaser.Math.Between(-30, 30),
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  private spawnHazard(): void {
    if (!this.isGameActive) return;

    const x = Phaser.Math.Between(50, 350);
    const hazard = this.hazards.create(x, -50, 'hazard') as Phaser.Physics.Arcade.Image;
    
    hazard.setDisplaySize(40, 40);
    hazard.setSize(25, 25); // Smaller hitbox = Fairer dodge
    hazard.setVelocityY(200 + (this.difficulty * 30));
    
    this.tweens.add({
        targets: hazard,
        angle: 360,
        duration: 1000,
        repeat: -1
    });
  }

  // --- INTERACTION LOGIC ---

  // This is the function that runs when chef touches an ingredient
  private handleCollectIngredient(_obj1: any, obj2: any): void {
    const ingredient = obj2 as Phaser.Physics.Arcade.Image;
    
    // 1. Immediately disable the ingredient so it can't be collected twice
    ingredient.disableBody(true, true); 

    // 2. Visual Effects (Particles)
    this.collectParticles.emitParticleAt(ingredient.x, ingredient.y, 10);

    // 3. Score Logic
    this.combo++;
    this.lastComboTime = this.time.now;
    const pointsToAdd = 10 + (this.combo * 2);
    this.score += pointsToAdd;
    
    // 4. Update UI
    this.scoreText.setText(`Score: ${this.score}`);

    // 5. FLOATING TEXT INTERACTION (Visual Feedback)
    this.showFloatingText(ingredient.x, ingredient.y, `+${pointsToAdd}`);

    // 6. Combo Text
    if (this.combo > 1) {
      this.comboText.setText(`${this.combo}x COMBO!`);
      this.comboText.setAlpha(1);
      this.tweens.add({
        targets: this.comboText,
        scale: { from: 1.5, to: 1 },
        alpha: { from: 1, to: 0 },
        duration: 800,
        ease: 'Back.out'
      });
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.highScoreText.setText(`Best: ${this.highScore}`);
      localStorage.setItem('chefHighScore', this.highScore.toString());
    }

    // 7. Chef Happy Animation
    this.tweens.add({
      targets: this.chef,
      scaleX: '*=1.2', 
      scaleY: '*=1.2',
      duration: 80,
      yoyo: true
    });
  }

  // New function to make points float up
  private showFloatingText(x: number, y: number, message: string): void {
    const floatText = this.add.text(x, y, message, {
        fontFamily: 'Arial',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#fff',
        stroke: '#000',
        strokeThickness: 3
    }).setOrigin(0.5);

    this.tweens.add({
        targets: floatText,
        y: y - 60, // Move up
        alpha: 0,  // Fade out
        duration: 800,
        ease: 'Power1',
        onComplete: () => {
            floatText.destroy();
        }
    });
  }

  private handleHitHazard(_obj1: any, obj2: any): void {
    if (this.isGameOver) return;

    const hazard = obj2 as Phaser.Physics.Arcade.Image;
    this.explosionParticles.emitParticleAt(hazard.x, hazard.y, 20);
    hazard.destroy();

    this.gameOver();
  }

  private gameOver(): void {
    this.isGameOver = true;
    this.isGameActive = false;
    
    this.physics.pause();
    this.chef.setTint(0xff0000);
    this.cameras.main.shake(200, 0.01);

    const goText = this.add.text(200, 250, 'GAME OVER', {
      fontFamily: 'Arial', fontSize: '48px', fontStyle: 'bold',
      color: '#ff0000', stroke: '#fff', strokeThickness: 6
    }).setOrigin(0.5).setScale(0);

    const restartText = this.add.text(200, 320, 'Tap to Restart', {
      fontFamily: 'Arial', fontSize: '24px', color: '#fff'
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: goText,
      scale: 1,
      duration: 500,
      ease: 'Back.out'
    });

    this.tweens.add({
      targets: restartText,
      alpha: 1,
      delay: 500,
      duration: 500,
      onComplete: () => {
        this.input.once('pointerdown', () => {
          this.scene.restart();
        });
      }
    });
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 400,
  height: 600,
  backgroundColor: '#000000',
  physics: {
    default: 'arcade',
    arcade: { 
      debug: false, 
      gravity: { x: 0, y: 0 }
    },
  },
  scene: GameScene,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  parent: 'game-container'
};

const container = document.createElement('div');
container.id = 'game-container';
document.body.style.cssText = 'margin:0; padding:0; background:#222; overflow:hidden; display:flex; justify-content:center; height:100vh; align-items:center;';
document.body.appendChild(container);

new Phaser.Game(config);